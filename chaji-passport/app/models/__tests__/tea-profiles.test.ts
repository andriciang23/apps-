import { describe, expect, it } from "vitest";
import { profileHandle, toProfile } from "../tea-profiles.server";
import { PROPOSED_TEA_PROFILES } from "../../data/proposed-tea-profiles";

describe("profileHandle", () => {
  it("makes ASCII handles from Japanese product handles", () => {
    expect(profileHandle("takamidori-matcha-たかみどり")).toBe("tea-takamidori-matcha");
    expect(profileHandle("dark-roast")).toBe("tea-dark-roast");
  });

  it("gives every proposed profile a unique handle", () => {
    const handles = PROPOSED_TEA_PROFILES.map((p) => profileHandle(p.handle));
    expect(new Set(handles).size).toBe(handles.length);
  });
});

describe("proposed profiles", () => {
  it("keep every score in 0–10", () => {
    for (const p of PROPOSED_TEA_PROFILES) {
      for (const v of [p.roast, p.umami, p.sweetness, p.astringency]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("toProfile", () => {
  const node = {
    id: "gid://shopify/Metaobject/1",
    handle: "tea-dark-roast",
    fields: [
      { key: "label", value: "Hojicha Aka" },
      { key: "family", value: "hojicha" },
      { key: "roast", value: "9" },
      { key: "umami", value: "2" },
      { key: "sweetness", value: "7" },
      { key: "astringency", value: null },
      { key: "caffeine", value: "low" },
      { key: "verified", value: "true" },
    ],
    product: { reference: { id: "gid://shopify/Product/1", handle: "dark-roast", title: "Aka", status: "ACTIVE", totalInventory: 0 } },
  };

  it("parses fields and treats zero stock as unavailable", () => {
    const p = toProfile(node)!;
    expect(p).toMatchObject({ roast: 9, umami: 2, sweetness: 7, astringency: 0, verified: true, available: false });
  });

  it("treats untracked inventory as available and drops orphan profiles", () => {
    const untracked = { ...node, product: { reference: { ...node.product.reference, totalInventory: null } } };
    expect(toProfile(untracked)!.available).toBe(true);
    expect(toProfile({ ...node, product: null })).toBeNull();
  });
});
