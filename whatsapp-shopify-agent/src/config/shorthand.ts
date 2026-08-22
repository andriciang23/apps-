/**
 * Owner shorthand and sizing rules, from PERMANENT_RULES.md.
 *
 * These are resolved before the model sees the message so that a mis-expansion
 * is a code bug with a test, not a model slip. HJPDDR and hjdr in particular are
 * different products, and confusing them puts the wrong tea in a customer's order.
 */

export const SHORTHAND: Record<string, string> = {
  hjpd: 'Hojicha Powder "Kaori"',
  hjpddr: "Dark Roast Hojicha Powder",
  hjdr: "Signature Hojicha Dark Roast (loose leaf)",
  kimi: "Kimidori Matcha",
  kmdr: "Kimidori Matcha",
  yama: "YAMA Signature Matcha",
  taka: "Takamidori",
  gmc: "Genmaicha Midori",
  gmpd: 'Genmaicha Powder "Asa-Midori"',
  hjkyo: 'Hojicha "Kyo"',
  hjgmc: "Hoji-Genmaicha",
  kitsune: "Kitsune Matcha",
  kitsu: "Kitsune Matcha",
  gmtb: "Genmaicha Teabags (20pc)",
};

/** Untracked sample/gift packs. Never becomes a line item or a ledger row. */
export const SKIP_TERMS = ["kohaku"];

/** Loose leaf has a default size; powders deliberately do not. */
export const LOOSE_LEAF_DEFAULT_SIZE = "80g";

/**
 * Products whose name alone does not identify the SKU.
 *
 * "Hojicha Powder 500g" could be Kaori or Dark Roast. Guessing here silently
 * ships the wrong product, so these must always be asked about.
 */
export const AMBIGUOUS_WITHOUT_QUALIFIER = ["hojicha powder"];

/** Kitsune 30g and 100g always mean Refill — never the Tin, never ask. */
export function forcedFormat(product: string, size?: string): string | undefined {
  const isKitsune = /kitsu/i.test(product);
  const isRefillSize = size === "30g" || size === "100g";
  return isKitsune && isRefillSize ? "Refill" : undefined;
}

/** Expand a shorthand token to its full product name, or return it unchanged. */
export function expand(token: string): string {
  return SHORTHAND[token.trim().toLowerCase()] ?? token;
}

export function isSkipTerm(text: string): boolean {
  return SKIP_TERMS.some((t) => text.toLowerCase().includes(t));
}

/**
 * Normalise an obviously mistyped size. "kimi 509g" means 500g.
 *
 * Only corrects to a size the catalogue actually sells and only when the typo is
 * within one digit — a genuinely two-way case must still be asked about.
 */
const KNOWN_SIZES = [20, 30, 40, 80, 100, 250, 500, 1000, 2000];

export function normaliseSize(grams: number): number | undefined {
  if (KNOWN_SIZES.includes(grams)) return grams;
  return KNOWN_SIZES.find((s) => Math.abs(s - grams) <= 9);
}
