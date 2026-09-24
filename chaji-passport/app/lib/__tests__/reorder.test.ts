import { describe, expect, it } from "vitest";
import { draftOrderInput, suggestReorder, type ParLine } from "../reorder";

const matcha500: ParLine = { variantId: "gid://shopify/ProductVariant/1", title: "Wholesale Matcha 500g", unitGrams: 500, parGrams: 2000 };
const kaori1kg: ParLine = { variantId: "gid://shopify/ProductVariant/2", title: "Hojicha Kaori 1kg", unitGrams: 1000, parGrams: 1000 };

describe("suggestReorder", () => {
  it("rounds up to whole units", () => {
    const lines = suggestReorder([matcha500], { [matcha500.variantId]: 700 });
    expect(lines).toEqual([{ variantId: matcha500.variantId, title: matcha500.title, quantity: 3, shortfallGrams: 1300 }]);
  });

  it("skips stocked items and items with no count", () => {
    expect(suggestReorder([matcha500, kaori1kg], { [matcha500.variantId]: 2500 })).toEqual([]);
  });

  it("treats negative counts as empty", () => {
    expect(suggestReorder([kaori1kg], { [kaori1kg.variantId]: -50 })[0].quantity).toBe(1);
  });
});

describe("draftOrderInput", () => {
  it("builds tagged draft input", () => {
    const input = draftOrderInput("gid://shopify/Customer/9", [{ variantId: "v", quantity: 2 }, { variantId: "w", quantity: 0 }]);
    expect(input.lineItems).toEqual([{ variantId: "v", quantity: 2 }]);
    expect(input.purchasingEntity).toEqual({ customerId: "gid://shopify/Customer/9" });
    expect(input.tags).toContain("chaji-reorder");
  });

  it("refuses empty orders and bad customer ids", () => {
    expect(() => draftOrderInput("gid://shopify/Customer/9", [])).toThrow();
    expect(() => draftOrderInput("9", [{ variantId: "v", quantity: 1 }])).toThrow();
  });
});
