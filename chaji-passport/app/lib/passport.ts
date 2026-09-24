// Stamp rules for the café / event passport. Pure functions; persistence lives
// in app/models/passport.server.ts.

export type StampKind = "cafe_drink" | "event" | "wheel_purchase";

export interface StampRecord {
  kind: StampKind;
  refCode: string;
  productId: string | null;
  dayKey: string;
  createdAt: Date;
}

/** Malaysia is UTC+8 with no DST. */
export const SHOP_UTC_OFFSET_MINUTES = 8 * 60;

export function dayKey(at: Date, offsetMinutes = SHOP_UTC_OFFSET_MINUTES) {
  return new Date(at.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Max café stamps one customer can collect per day (stops table-hopping). */
export const DAILY_CAFE_CAP = 3;

export type StampDecision =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "daily_cap" };

export function canStamp(
  existing: StampRecord[],
  request: { kind: StampKind; refCode: string; dayKey: string },
): StampDecision {
  const today = existing.filter((s) => s.dayKey === request.dayKey);
  if (today.some((s) => s.kind === request.kind && s.refCode === request.refCode)) {
    return { ok: false, reason: "duplicate" };
  }
  if (
    request.kind === "cafe_drink" &&
    today.filter((s) => s.kind === "cafe_drink").length >= DAILY_CAFE_CAP
  ) {
    return { ok: false, reason: "daily_cap" };
  }
  return { ok: true };
}

export interface Milestone {
  distinctTeas: number;
  key: string;
  title: string;
}

// Titles only. What each milestone unlocks is the owner's call and is set in
// the admin, so nothing here promises a discount.
export const MILESTONES: Milestone[] = [
  { distinctTeas: 1, key: "first_cup", title: "First cup" },
  { distinctTeas: 3, key: "explorer", title: "Explorer" },
  { distinctTeas: 6, key: "roaster", title: "Roaster" },
  { distinctTeas: 10, key: "chajin", title: "Chajin" },
];

export interface Progress {
  totalStamps: number;
  distinctTeas: number;
  reached: Milestone[];
  next: Milestone | null;
  toNext: number;
}

export function progress(stamps: StampRecord[]): Progress {
  const teas = new Set(stamps.map((s) => s.productId).filter(Boolean));
  const distinctTeas = teas.size;
  const reached = MILESTONES.filter((m) => distinctTeas >= m.distinctTeas);
  const next = MILESTONES.find((m) => distinctTeas < m.distinctTeas) ?? null;
  return {
    totalStamps: stamps.length,
    distinctTeas,
    reached,
    next,
    toNext: next ? next.distinctTeas - distinctTeas : 0,
  };
}

/** Milestones crossed by adding one stamp — drives the "you levelled up" moment. */
export function newlyReached(before: StampRecord[], added: StampRecord): Milestone[] {
  const was = new Set(progress(before).reached.map((m) => m.key));
  return progress([...before, added]).reached.filter((m) => !was.has(m.key));
}
