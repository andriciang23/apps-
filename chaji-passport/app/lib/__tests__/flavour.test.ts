import { describe, expect, it } from "vitest";
import {
  matchScore,
  nextToTry,
  recommend,
  tasteFromHistory,
  tasteFromWheel,
  type TeaProfile,
} from "../flavour";

const tea = (over: Partial<TeaProfile> & Pick<TeaProfile, "productId">): TeaProfile => ({
  handle: over.productId,
  label: over.productId,
  family: "hojicha",
  caffeine: "low",
  verified: true,
  available: true,
  roast: 5,
  umami: 5,
  sweetness: 5,
  astringency: 5,
  ...over,
});

const aka = tea({ productId: "aka", roast: 9, umami: 2, sweetness: 7, astringency: 1 });
const kyo = tea({ productId: "kyo", roast: 7, umami: 3, sweetness: 7, astringency: 2 });
const kitsune = tea({ productId: "kitsune", family: "matcha", roast: 0, umami: 9, sweetness: 6, astringency: 2 });
const sencha = tea({ productId: "sencha", family: "sencha", roast: 0, umami: 6, sweetness: 4, astringency: 6 });
const all = [aka, kyo, kitsune, sencha];

describe("matchScore", () => {
  it("is 100 for identical tastes and 0 for opposite corners", () => {
    expect(matchScore(aka, aka)).toBe(100);
    const zero = { roast: 0, umami: 0, sweetness: 0, astringency: 0 };
    const ten = { roast: 10, umami: 10, sweetness: 10, astringency: 10 };
    expect(matchScore(zero, ten)).toBe(0);
  });
});

describe("recommend", () => {
  it("puts dark roasts first for a dark-roast dial", () => {
    const [first, second] = recommend(tasteFromWheel(9, 2), all);
    expect(first.profile.productId).toBe("aka");
    expect(second.profile.productId).toBe("kyo");
  });

  it("hides unverified or unavailable teas unless asked", () => {
    const hidden = [tea({ productId: "x", verified: false, roast: 9, umami: 2 }), tea({ productId: "y", available: false, roast: 9, umami: 2 })];
    expect(recommend(tasteFromWheel(9, 2), hidden)).toEqual([]);
    expect(recommend(tasteFromWheel(9, 2), hidden, { includeUnverified: true }).map((m) => m.profile.productId)).toEqual(["x"]);
  });

  it("filters by family and exclusions", () => {
    const r = recommend(tasteFromWheel(9, 2), all, { families: ["matcha", "sencha"], exclude: ["sencha"] });
    expect(r.map((m) => m.profile.productId)).toEqual(["kitsune"]);
  });
});

describe("tasteFromHistory", () => {
  const now = new Date("2026-09-24T00:00:00Z");
  it("returns null with no profiled teas", () => {
    expect(tasteFromHistory([{ productId: "nope", at: now }], all, now)).toBeNull();
  });

  it("weights recent cups more heavily", () => {
    const oldMatcha = { productId: "kitsune", at: new Date("2026-03-01T00:00:00Z") };
    const recentAka = { productId: "aka", at: now };
    const taste = tasteFromHistory([oldMatcha, recentAka], all, now)!;
    expect(taste.roast).toBeGreaterThan(6);
  });
});

describe("nextToTry", () => {
  it("never suggests something already tried", () => {
    const now = new Date();
    const picks = nextToTry([{ productId: "aka", at: now }], all, { limit: 5 }, now);
    expect(picks.map((m) => m.profile.productId)).not.toContain("aka");
    expect(picks[0].profile.productId).toBe("kyo");
  });
});
