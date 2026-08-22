import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import { sendWhatsAppText } from "./whatsapp.js";
import { handleOwnerMessage, isOwner } from "./ops/router.js";
import type { WhatsAppMessage, WhatsAppWebhookPayload } from "./types.js";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/** Meta retries for a bounded window, so a TTL map is enough — no unbounded Set. */
const PROCESSED_ID_TTL_MS = 10 * 60 * 1000;
const processedMessageIds = new Map<string, number>();

function isDuplicateMessage(id: string): boolean {
  const now = Date.now();
  for (const [seenId, seenAt] of processedMessageIds) {
    if (now - seenAt > PROCESSED_ID_TTL_MS) processedMessageIds.delete(seenId);
  }
  if (processedMessageIds.has(id)) return true;
  processedMessageIds.set(id, now);
  return false;
}

export function createServer() {
  const app = express();

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    })
  );

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).send("ok");
  });

  app.get("/webhook", (req: Request, res: Response) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const matches =
      req.query["hub.mode"] === "subscribe" &&
      typeof verifyToken === "string" &&
      req.query["hub.verify_token"] === verifyToken;

    if (matches) res.status(200).send(req.query["hub.challenge"]);
    else res.sendStatus(403);
  });

  app.post("/webhook", (req: RawBodyRequest, res: Response) => {
    if (!verifySignature(req)) {
      res.sendStatus(401);
      return;
    }

    res.sendStatus(200); // Meta expects a fast ack and retries on timeout

    handleWebhookPayload(req.body as WhatsAppWebhookPayload).catch((err) => {
      console.error("Failed to handle webhook payload:", err);
    });
  });

  return app;
}

/**
 * Verify the Meta signature.
 *
 * Two deliberate choices here, both fixing real holes:
 *
 * 1. A missing META_APP_SECRET returns false, it does not pass. The previous
 *    behaviour was to return true and accept anything — with the owner allowlist
 *    as the only other defence, an unverified payload could claim any sender.
 *    Startup also refuses without the secret, so this is defence in depth.
 * 2. Lengths are compared before timingSafeEqual, which throws on a mismatch.
 *    The header is attacker-controlled, so an unequal-length signature would
 *    otherwise become an uncaught throw and a 500 instead of a clean 401.
 */
export function verifySignature(req: RawBodyRequest): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;

  const header = req.header("x-hub-signature-256");
  if (!header || !req.rawBody) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");

  const received = Buffer.from(header);
  const computed = Buffer.from(expected);
  if (received.length !== computed.length) return false;

  return crypto.timingSafeEqual(received, computed);
}

async function handleWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        if (isDuplicateMessage(message.id)) continue;
        await handleMessage(message);
      }
    }
  }
}

async function handleMessage(message: WhatsAppMessage): Promise<void> {
  // Anyone not on the allowlist gets no reply at all. Silence rather than a
  // refusal: a stranger should not learn that this number runs anything.
  if (!isOwner(message.from)) {
    console.warn(`Ignored message from non-owner ${redact(message.from)}`);
    return;
  }

  if (message.type !== "text" || !message.text) {
    await sendWhatsAppText(message.from, "I can only read text messages at the moment.");
    return;
  }

  try {
    const reply = await handleOwnerMessage(message.from, message.text.body);
    await sendWhatsAppText(message.from, reply);
  } catch (err) {
    console.error("Assistant failed:", err);
    await sendWhatsAppText(
      message.from,
      "Something went wrong and I could not answer. Nothing was written."
    ).catch(() => {});
  }
}

/** Log enough to trace a message, never the number itself or its contents. */
function redact(phone: string): string {
  return `***${phone.slice(-4)}`;
}
