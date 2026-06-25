import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import { sendWhatsAppText } from "./whatsapp.js";
import { matchLineItems, createDraftOrder } from "./shopify.js";
import { parseOrderMessage } from "./orderParser.js";
import type { WhatsAppWebhookPayload } from "./types.js";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const processedMessageIds = new Set<string>();

export function createServer() {
  const app = express();

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    })
  );

  // Webhook verification handshake (Meta calls this once when you save the webhook config)
  app.get("/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  app.post("/webhook", (req: RawBodyRequest, res: Response) => {
    if (!verifySignature(req)) {
      res.sendStatus(401);
      return;
    }

    // Ack immediately; Meta expects a fast 200 and will retry on timeout.
    res.sendStatus(200);

    handleWebhookPayload(req.body as WhatsAppWebhookPayload).catch((err) => {
      console.error("Failed to handle webhook payload:", err);
    });
  });

  return app;
}

function verifySignature(req: RawBodyRequest): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // signature check optional but recommended

  const signatureHeader = req.header("x-hub-signature-256");
  if (!signatureHeader || !req.rawBody) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}

async function handleWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const messages = value.messages ?? [];

      for (const message of messages) {
        if (processedMessageIds.has(message.id)) continue;
        processedMessageIds.add(message.id);

        if (message.type !== "text" || !message.text) {
          await sendWhatsAppText(
            message.from,
            "Sorry, I can only read text messages for orders right now. Please type your order as text."
          );
          continue;
        }

        const profileName = value.contacts?.find((c) => c.wa_id === message.from)?.profile.name;
        await handleOrderMessage(message.from, message.text.body, profileName);
      }
    }
  }
}

async function handleOrderMessage(
  from: string,
  text: string,
  profileName?: string
): Promise<void> {
  try {
    const parsed = await parseOrderMessage(text, profileName);

    if (!parsed.is_order || parsed.items.length === 0) {
      return; // not an order, stay silent (e.g. greetings, questions)
    }

    const matchedItems = await matchLineItems(parsed.items);

    const noteLines = [
      `WhatsApp order from ${profileName ?? "unknown"} (${from})`,
      parsed.shipping_address ? `Address: ${parsed.shipping_address}` : null,
      parsed.notes ? `Notes: ${parsed.notes}` : null,
      `Original message: "${text}"`,
    ].filter(Boolean);

    const draftOrder = await createDraftOrder(matchedItems, noteLines.join("\n"));

    await sendWhatsAppText(from, buildSummaryMessage(draftOrder, matchedItems));
  } catch (err) {
    console.error("Error processing order message:", err);
    await sendWhatsAppText(
      from,
      "Sorry, something went wrong while processing your order. We'll follow up shortly."
    ).catch(() => {});
  }
}

function buildSummaryMessage(
  draftOrder: { name: string; invoiceUrl: string; totalPrice: string },
  matchedItems: Awaited<ReturnType<typeof matchLineItems>>
): string {
  const lines = [`Order received! Draft ${draftOrder.name} created for review.`, ""];

  for (const item of matchedItems) {
    if (item.unmatched) {
      lines.push(`- ${item.requested.product_query} x${item.requested.quantity} (could not match product, flagged for manual review)`);
    } else {
      lines.push(`- ${item.matchedTitle} x${item.requested.quantity} @ ${item.matchedPrice}`);
    }
  }

  lines.push("", `Total: ${draftOrder.totalPrice}`, `Review: ${draftOrder.invoiceUrl}`);
  return lines.join("\n");
}
