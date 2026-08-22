/** Environment loading and validation. Fails at startup, never mid-conversation. */

/** Vars without which the service cannot function at all. */
const REQUIRED = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "META_APP_SECRET",
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_CLIENT_ID",
  "SHOPIFY_CLIENT_SECRET",
  "ANTHROPIC_API_KEY",
  "OWNER_PHONE_NUMBERS",
] as const;

export const DEFAULT_MODEL = "claude-sonnet-5";

/**
 * META_APP_SECRET is required, not recommended.
 *
 * Without it webhook signatures cannot be verified, and since the owner
 * allowlist is the entire security model here, an unverified payload can claim
 * to come from any number it likes. Refusing to start is the only safe
 * behaviour; warning and serving anyway is not.
 */
export function validateEnv(): string[] {
  return REQUIRED.filter((key) => !process.env[key]?.trim());
}

/**
 * Digits-only phone numbers permitted to reach the assistant.
 *
 * WhatsApp delivers `from` as digits with no leading +, so we normalise both
 * sides to digits and compare exactly. No prefix or suffix matching: "60123"
 * must never match "601234567890".
 */
export function ownerNumbers(): Set<string> {
  const raw = process.env.OWNER_PHONE_NUMBERS ?? "";
  return new Set(
    raw
      .split(",")
      .map((n) => n.replace(/\D/g, ""))
      .filter(Boolean)
  );
}

export function model(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}
