// HoReCa reorder desk: turn "what's on my shelf" into a draft order.
// The draft is created for the owner to review — the app never completes it.

export interface ParLine {
  variantId: string;
  title: string;
  unitGrams: number; // grams in one unit of this variant
  parGrams: number; // grams the buyer wants on the shelf
}

export interface ReorderLine {
  variantId: string;
  title: string;
  quantity: number;
  shortfallGrams: number;
}

/**
 * Order enough whole units to get back to par. Items with no on-hand figure
 * are skipped rather than guessed at.
 */
export function suggestReorder(
  pars: ParLine[],
  onHandGrams: Record<string, number | undefined>,
): ReorderLine[] {
  const lines: ReorderLine[] = [];
  for (const par of pars) {
    const onHand = onHandGrams[par.variantId];
    if (onHand === undefined || !Number.isFinite(onHand) || par.unitGrams <= 0) continue;
    const shortfall = par.parGrams - Math.max(0, onHand);
    if (shortfall <= 0) continue;
    lines.push({
      variantId: par.variantId,
      title: par.title,
      quantity: Math.ceil(shortfall / par.unitGrams),
      shortfallGrams: shortfall,
    });
  }
  return lines;
}

export const REORDER_TAG = "chaji-reorder";

/** Variables for the draftOrderCreate mutation. */
export function draftOrderInput(
  customerId: string,
  lines: Pick<ReorderLine, "variantId" | "quantity">[],
  note?: string,
) {
  if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(customerId)) {
    throw new Error("customerId must be a Customer gid");
  }
  const lineItems = lines
    .filter((l) => Number.isInteger(l.quantity) && l.quantity > 0)
    .map(({ variantId, quantity }) => ({ variantId, quantity }));
  if (lineItems.length === 0) throw new Error("Nothing to reorder");
  return {
    purchasingEntity: { customerId },
    lineItems,
    tags: [REORDER_TAG, "horeca"],
    note: note?.slice(0, 500) || "Reorder from Chaji wholesale desk",
  };
}
