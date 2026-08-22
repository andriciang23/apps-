import { parseGrams, shopifyGraphQL } from "./client.js";
import type { VariantMatch } from "../types.js";

/* ── Variant search ────────────────────────────────────────────────────────── */

interface ProductSearchResult {
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        variants: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              price: string;
              sku: string | null;
              inventoryQuantity: number | null;
            };
          }>;
        };
      };
    }>;
  };
}

const PRODUCT_SEARCH = `
  query SearchProducts($query: String!) {
    products(first: 10, query: $query) {
      edges {
        node {
          id
          title
          variants(first: 50) {
            edges { node { id title price sku inventoryQuantity } }
          }
        }
      }
    }
  }
`;

export interface VariantQuery {
  product: string;
  size?: string;
  format?: string;
}

/**
 * Find the variants matching a request.
 *
 * The original implementation took variants.edges[0] — always the first variant.
 * This catalogue is almost entirely size and format variants (80g/250g/500g/1kg/2kg,
 * Tin vs Refill), so that silently shipped whichever variant Shopify happened to
 * return first, at that variant's price. Here every variant is scored and a tie is
 * reported as ambiguous rather than resolved by guessing.
 */
export async function findVariants(q: VariantQuery): Promise<{
  matches: VariantMatch[];
  ambiguous: boolean;
}> {
  const escaped = q.product.replace(/['"\\]/g, " ").trim();
  const data = await shopifyGraphQL<ProductSearchResult>(PRODUCT_SEARCH, {
    query: `${escaped} status:active`,
  });

  const wantGrams = q.size ? parseGrams(q.size) : undefined;
  const wantFormat = q.format?.toLowerCase();

  const all: Array<VariantMatch & { score: number }> = [];
  for (const { node: product } of data.products.edges) {
    for (const { node: variant } of product.variants.edges) {
      const label = `${product.title} ${variant.title}`;
      const grams = parseGrams(variant.title) ?? parseGrams(product.title);

      let score = 0;
      if (wantGrams !== undefined) {
        if (grams === wantGrams) score += 10;
        else if (grams !== undefined) score -= 5;
      }
      if (wantFormat) {
        if (label.toLowerCase().includes(wantFormat)) score += 5;
        else score -= 3;
      }
      score += overlap(escaped, product.title);

      all.push({
        variantId: variant.id,
        productTitle: product.title,
        variantTitle: variant.title === "Default Title" ? "" : variant.title,
        price: variant.price,
        sku: variant.sku ?? undefined,
        available: variant.inventoryQuantity ?? undefined,
        score,
      });
    }
  }

  if (all.length === 0) return { matches: [], ambiguous: false };

  all.sort((a, b) => b.score - a.score);
  const best = all[0].score;
  const top = all.filter((v) => v.score === best);

  // A size was asked for and nothing carries it: report every candidate rather
  // than serving the closest, so the caller asks instead of guessing.
  const sizeUnmet = wantGrams !== undefined && best < 10;
  const matches = (sizeUnmet ? all : top).slice(0, 8).map(({ score: _score, ...v }) => v);

  return { matches, ambiguous: top.length > 1 || sizeUnmet };
}

/** Shared word count, so "kimidori matcha" beats "genmaicha" for "kimidori". */
function overlap(query: string, title: string): number {
  const words = new Set(title.toLowerCase().split(/\W+/).filter(Boolean));
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && words.has(w)).length;
}

