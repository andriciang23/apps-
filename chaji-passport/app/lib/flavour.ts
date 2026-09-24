// Flavour space shared by the Roast & Umami Wheel, the café passport and the
// "next tea to try" suggestions. Pure functions only — no Shopify calls here.

export const AXES = ["roast", "umami", "sweetness", "astringency"] as const;
export type Axis = (typeof AXES)[number];
export type Taste = Record<Axis, number>; // each 0–10

export type TeaFamily = "hojicha" | "matcha" | "genmaicha" | "sencha" | "oolong";

export interface TeaProfile extends Taste {
  productId: string; // gid://shopify/Product/...
  handle: string;
  label: string;
  family: TeaFamily;
  caffeine: "low" | "medium" | "high";
  verified: boolean; // owner has checked the numbers
  available: boolean; // product is ACTIVE and in stock
}

export interface Match {
  profile: TeaProfile;
  /** 0–100, higher is closer. */
  score: number;
}

// Roast and umami are what the wheel's two dials control, so they dominate.
const DEFAULT_WEIGHTS: Taste = {
  roast: 1.5,
  umami: 1.5,
  sweetness: 1,
  astringency: 1,
};

const MAX_DISTANCE = Math.sqrt(
  AXES.reduce((sum, a) => sum + DEFAULT_WEIGHTS[a] * 10 * 10, 0),
);

export function distance(a: Taste, b: Taste, weights: Taste = DEFAULT_WEIGHTS) {
  return Math.sqrt(
    AXES.reduce((sum, axis) => sum + weights[axis] * (a[axis] - b[axis]) ** 2, 0),
  );
}

export function matchScore(a: Taste, b: Taste) {
  return Math.round(100 * (1 - distance(a, b) / MAX_DISTANCE));
}

export interface RecommendOptions {
  limit?: number;
  exclude?: Iterable<string>; // productIds
  families?: TeaFamily[];
  /** Include profiles the owner has not verified yet. Off for customers. */
  includeUnverified?: boolean;
}

export function recommend(
  target: Taste,
  profiles: TeaProfile[],
  { limit = 3, exclude = [], families, includeUnverified = false }: RecommendOptions = {},
): Match[] {
  const excluded = new Set(exclude);
  return profiles
    .filter(
      (p) =>
        p.available &&
        (includeUnverified || p.verified) &&
        !excluded.has(p.productId) &&
        (!families || families.includes(p.family)),
    )
    .map((profile) => ({ profile, score: matchScore(target, profile) }))
    .sort((x, y) => y.score - x.score || x.profile.label.localeCompare(y.profile.label))
    .slice(0, limit);
}

export interface TastingEvent {
  productId: string;
  at: Date;
}

const HALF_LIFE_DAYS = 60;

/**
 * A customer's taste = recency-weighted average of the teas they have had.
 * Returns null when none of their teas have a profile yet.
 */
export function tasteFromHistory(
  history: TastingEvent[],
  profiles: TeaProfile[],
  now: Date = new Date(),
): Taste | null {
  const byId = new Map(profiles.map((p) => [p.productId, p]));
  const totals: Taste = { roast: 0, umami: 0, sweetness: 0, astringency: 0 };
  let weightSum = 0;

  for (const event of history) {
    const profile = byId.get(event.productId);
    if (!profile) continue;
    const ageDays = Math.max(0, (now.getTime() - event.at.getTime()) / 86_400_000);
    const w = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    for (const axis of AXES) totals[axis] += w * profile[axis];
    weightSum += w;
  }

  if (weightSum === 0) return null;
  for (const axis of AXES) totals[axis] = round1(totals[axis] / weightSum);
  return totals;
}

/** Closest teas the customer has not tried yet. */
export function nextToTry(
  history: TastingEvent[],
  profiles: TeaProfile[],
  opts: Omit<RecommendOptions, "exclude"> = {},
  now: Date = new Date(),
): Match[] {
  const taste = tasteFromHistory(history, profiles, now);
  if (!taste) return [];
  return recommend(taste, profiles, {
    ...opts,
    exclude: history.map((h) => h.productId),
  });
}

/** Map wheel position (angle around roast, radius = umami) to a taste. */
export function tasteFromWheel(roast: number, umami: number): Taste {
  const r = clamp(roast);
  const u = clamp(umami);
  // Roasting lifts sweetness and removes astringency; umami rides with shading.
  return {
    roast: r,
    umami: u,
    sweetness: round1(clamp(3 + r * 0.5)),
    astringency: round1(clamp(6 - r * 0.6 + u * 0.1)),
  };
}

function clamp(n: number, lo = 0, hi = 10) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
