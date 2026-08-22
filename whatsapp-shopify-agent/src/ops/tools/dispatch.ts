import { findCustomer, getCustomerById } from "../../shopify/customers.js";
import { findVariants } from "../../shopify/catalogue.js";
import { parseGrams } from "../../shopify/client.js";
import {
  expand,
  forcedFormat,
  isSkipTerm,
  LOOSE_LEAF_DEFAULT_SIZE,
  normaliseSize,
} from "../../config/shorthand.js";
import type { DraftLineItem } from "../../types.js";
import { callOpsTool } from "../opsBridge.js";
import { consume, fingerprint, stage } from "../approval.js";
import { findEntry, listFiles, loadFile } from "../files.js";
import { createDraftOrder, renderProposal, renderStockOut } from "../orders.js";
import { sendWhatsAppDocument } from "../../whatsapp.js";

/**
 * Tool dispatch.
 *
 * The guarantees live here, not in the prompt: the approval gate, the address
 * assertion and the registry lookup are enforced around the model. The prompt
 * tells the assistant what to do; this file makes sure it cannot do otherwise.
 */

type Args = Record<string, unknown>;

export async function dispatch(name: string, args: Args, sender: string): Promise<unknown> {
  switch (name) {
    case "get_facts":
      return callOpsTool(name, args.section ? { section: String(args.section) } : {});

    case "get_velocity":
      return callOpsTool(name, args.sku ? { sku: String(args.sku) } : {});

    case "find_customer": {
      const customer = await findCustomer(String(args.query ?? ""));
      if (!customer) return { found: false };
      return {
        found: true,
        customer,
        hasDefaultAddress: Boolean(customer.defaultAddress?.address1),
      };
    }

    case "find_variant":
      return findVariantGated(args);

    case "create_draft_order":
      return createDraftOrderGated(args, sender);

    case "send_file":
      return sendFileGated(args, sender);

    default:
      return { error: `unknown tool: ${name}` };
  }
}

/**
 * Shorthand and sizing resolved in code, not left to the model.
 *
 * Getting HJPDDR (powder) and hjdr (loose leaf) the wrong way round puts the
 * wrong tea in a customer's order, and Kitsune 30g is always the Refill. Rules
 * that specific belong somewhere they can be tested, not in a prompt.
 */
async function findVariantGated(args: Args) {
  const raw = String(args.product ?? "");
  if (isSkipTerm(raw)) {
    return { matches: [], ambiguous: false, skip: true, reason: "Kohaku is untracked — always skipped." };
  }

  const product = expand(raw);
  let size = args.size ? String(args.size) : undefined;

  // "kimi 509g" means 500g. Only snaps to a size actually sold, and only within
  // one digit — a genuine two-way case still has to be asked about.
  const grams = size ? parseGrams(size) : undefined;
  if (grams !== undefined) {
    const corrected = normaliseSize(grams);
    if (corrected !== undefined && corrected !== grams) size = `${corrected}g`;
  }

  const format = forcedFormat(product, size) ?? (args.format ? String(args.format) : undefined);
  const result = await findVariants({ product, size, format });

  return {
    ...result,
    resolvedProduct: product,
    resolvedSize: size,
    resolvedFormat: format,
    looseLeafDefault: LOOSE_LEAF_DEFAULT_SIZE,
  };
}

/**
 * The write gate.
 *
 * First call stages a proposal and returns the summary for the model to show —
 * it does not write. Only a second, byte-identical call made after the owner
 * replied yes gets through. Changing anything after approval changes the
 * fingerprint and the write is refused.
 */
async function createDraftOrderGated(args: Args, sender: string) {
  const customerId = String(args.customerId ?? "");
  const lineItems = (args.lineItems ?? []) as DraftLineItem[];

  if (!customerId || lineItems.length === 0) {
    return { created: false, error: "customerId and at least one line item are required" };
  }

  const customer = await getCustomerById(customerId);
  if (!customer) return { created: false, error: `customer ${customerId} not found` };

  if (!customer.defaultAddress?.address1) {
    return {
      created: false,
      error:
        `${customer.name} has no default address in Shopify. Billing address can only be set when ` +
        `the draft is created, so this draft cannot be created. Add the address in Shopify first.`,
    };
  }

  const fp = fingerprint({ customerId: customer.id, lineItems });
  const decision = consume(sender, fp);

  if (!decision.allowed) {
    const summary = renderProposal(customer, lineItems);
    stage(sender, fp, summary);
    return { created: false, needsApproval: true, reason: decision.reason, showToOwner: summary };
  }

  const note = `Created from WhatsApp ops assistant for ${customer.name}`;
  const result = await createDraftOrder(customer, lineItems, note);

  // PERMANENT_RULES §I — assert on the mutation's own return, do not assume.
  if (!result.shippingAddressPresent || !result.billingAddressPresent) {
    return {
      created: true,
      addressCheckFailed: true,
      draft: result,
      error:
        `${result.name} was created but came back with ` +
        `${!result.shippingAddressPresent ? "no shipping address" : ""}` +
        `${!result.shippingAddressPresent && !result.billingAddressPresent ? " and " : ""}` +
        `${!result.billingAddressPresent ? "no billing address" : ""}. ` +
        `Report this as a failure — billing cannot be added after creation.`,
    };
  }

  return { created: true, draft: result, stockOut: renderStockOut(lineItems) };
}

/** Registry keys only. A path in the message is never a file the assistant can read. */
async function sendFileGated(args: Args, sender: string) {
  const key = args.key ? String(args.key) : "";
  if (!key) return { sent: false, available: listFiles() };

  const entry = findEntry(key);
  if (!entry) return { sent: false, error: `"${key}" is not in the registry`, available: listFiles() };

  try {
    const file = await loadFile(entry);
    await sendWhatsAppDocument(sender, file.buffer, file.filename, entry.label);
    return {
      sent: true,
      label: entry.label,
      filename: file.filename,
      lastModified: file.lastModified,
      staleAgainst: file.staleAgainst,
    };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
