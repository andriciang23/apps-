import { describe, expect, it } from "vitest";
import { canStamp, dayKey, DAILY_CAFE_CAP, newlyReached, progress, type StampRecord } from "../passport";

const stamp = (refCode: string, productId: string | null, day = "2026-09-24"): StampRecord => ({
  kind: "cafe_drink",
  refCode,
  productId,
  dayKey: day,
  createdAt: new Date(),
});

describe("dayKey", () => {
  it("uses Malaysia time, not UTC", () => {
    // 17:00 UTC on the 23rd is 01:00 on the 24th in Kuala Lumpur.
    expect(dayKey(new Date("2026-09-23T17:00:00Z"))).toBe("2026-09-24");
    expect(dayKey(new Date("2026-09-23T15:59:00Z"))).toBe("2026-09-23");
  });
});

describe("canStamp", () => {
  it("blocks the same drink twice in a day but allows it tomorrow", () => {
    const existing = [stamp("hojicha-latte", "kaori")];
    expect(canStamp(existing, { kind: "cafe_drink", refCode: "hojicha-latte", dayKey: "2026-09-24" })).toEqual({ ok: false, reason: "duplicate" });
    expect(canStamp(existing, { kind: "cafe_drink", refCode: "hojicha-latte", dayKey: "2026-09-25" })).toEqual({ ok: true });
  });

  it("caps café stamps per day but not event stamps", () => {
    const existing = Array.from({ length: DAILY_CAFE_CAP }, (_, i) => stamp(`d${i}`, `p${i}`));
    expect(canStamp(existing, { kind: "cafe_drink", refCode: "new", dayKey: "2026-09-24" })).toEqual({ ok: false, reason: "daily_cap" });
    expect(canStamp(existing, { kind: "event", refCode: "workshop-oct", dayKey: "2026-09-24" })).toEqual({ ok: true });
  });
});

describe("progress", () => {
  it("counts distinct teas, not cups", () => {
    const p = progress([stamp("a", "kaori"), stamp("b", "kaori", "2026-09-25"), stamp("c", "aka")]);
    expect(p.totalStamps).toBe(3);
    expect(p.distinctTeas).toBe(2);
    expect(p.next?.key).toBe("explorer");
    expect(p.toNext).toBe(1);
  });

  it("reports a milestone only on the stamp that crosses it", () => {
    const before = [stamp("a", "kaori"), stamp("b", "aka")];
    expect(newlyReached(before, stamp("c", "kimidori")).map((m) => m.key)).toEqual(["explorer"]);
    expect(newlyReached(before, stamp("c", "aka", "2026-09-26"))).toEqual([]);
  });
});
