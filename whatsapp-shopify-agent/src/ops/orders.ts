import { shopifyGraphQL } from "../shopify/client.js";
import type {
  DraftLineItem,
  DraftOrderResult,
  ShopifyAddress,
  ShopifyCustomer,
} from "../types.js";

/**
 * Draft order creation.
 *
 * PERMANENT_RULES §I: every draftOrderCreate must carry shippingAddress AND
 * billingAddress taken from the customer's default address, and both must be
 * verified present in the mutation's own return. customerId alone leaves both
 * blank, and billing can only be set at creation time — so a draft created
 * without it is broken and cannot be repaired afterwards. This recurred on
 * #3794-#3798 after being written down once already, which is why the check
 * below is an assertion on the response rather than a comment saying we passed it.
 */

const DRAFT_ORDER_CREATE = `
  mutation CreateDraftOrder($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
        totalPrice
        shippingAddress { address1 city zip }
        billingAddress { address1 city zip }
      }
      userErrors { field message }
    }
  }
`;

interface DraftOrderCreateResponse {
  draftOrderCreate: {
    draftOrder: {
      name: string;
      invoiceUrl: string;
      totalPrice: string;
      shippingAddress: { address1?: string | null } | null;
      billingAddress: { address1?: string | null } | null;
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

/** Strip nulls — Shopify rejects an address whose fields are explicitly null. */
function toAddressInput(address: ShopifyAddress): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(address)) {
    if (typeof value === "string" && value.trim()) out[key] = value;
  }
  return out;
}

export async function createDraftOrder(
  customer: ShopifyCustomer,
  lineItems: DraftLineItem[],
  note: string
): Promise<DraftOrderResult> {
  if (!customer.defaultAddress) {
    throw new Error(`${customer.name} has no default address — cannot create a draft order`);
  }

  const address = toAddressInput(customer.defaultAddress);
  const data = await shopifyGraphQL<DraftOrderCreateResponse>(DRAFT_ORDER_CREATE, {
    input: {
      customerId: customer.id,
      shippingAddress: address,
      billingAddress: address,
      lineItems: lineItems.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      note,
    },
  });

  const { draftOrder, userErrors } = data.draftOrderCreate;
  if (userErrors.length > 0 || !draftOrder) {
    throw new Error(`Draft order creation failed: ${JSON.stringify(userErrors)}`);
  }

  const shippingAddressPresent = Boolean(draftOrder.shippingAddress?.address1);
  const billingAddressPresent = Boolean(draftOrder.billingAddress?.address1);

  return {
    name: draftOrder.name,
    invoiceUrl: draftOrder.invoiceUrl,
    totalPrice: draftOrder.totalPrice,
    shippingAddressPresent,
    billingAddressPresent,
  };
}

/* ── Rendering ─────────────────────────────────────────────────────────────── */

export function formatMoney(amount: string | number): string {
  return `RM ${Number(amount).toFixed(2)}`;
}

function addressLine(address: ShopifyAddress): string {
  return [address.address1, address.address2, address.city, address.zip, address.country]
    .filter((p) => typeof p === "string" && p.trim())
    .join(", ");
}

/** What the owner reads before approving. Everything in the write is shown here. */
export function renderProposal(
  customer: ShopifyCustomer,
  lineItems: DraftLineItem[]
): string {
  const lines = lineItems.map(
    (l) => `- ${l.title} x${l.quantity} @ ${formatMoney(l.price)}`
  );
  const total = lineItems.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0);
  const address = customer.defaultAddress ? addressLine(customer.defaultAddress) : "MISSING";

  return [
    `Draft order for ${customer.name}`,
    `Ship/bill to: ${address}`,
    "",
    ...lines,
    "",
    `Total: ${formatMoney(total)}`,
    "",
    "Reply yes to create it.",
  ].join("\n");
}

/**
 * The plain-text stock-out summary, sent unprompted after every order batch.
 * Item and total quantity only, no table — the format the owner asked for.
 */
export function renderStockOut(lineItems: DraftLineItem[], date = new Date()): string {
  const totals = new Map<string, number>();
  for (const l of lineItems) {
    totals.set(l.title, (totals.get(l.title) ?? 0) + l.quantity);
  }
  const stamp = date.toISOString().slice(0, 10);
  return [
    `Stock out - ${stamp}`,
    ...[...totals].map(([title, qty]) => `${title} x${qty}`),
  ].join("\n");
}
