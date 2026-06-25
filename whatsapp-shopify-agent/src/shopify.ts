import type { MatchedLineItem, ParsedOrderItem } from "./types.js";

const API_VERSION = "2024-10";

function getConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!domain || !token) {
    throw new Error("SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN must be set");
  }
  return { domain, token };
}

async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const { domain, token } = getConfig();
  const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data as T;
}

interface ProductSearchResult {
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        variants: { edges: Array<{ node: { id: string; title: string; price: string } }> };
      };
    }>;
  };
}

const PRODUCT_SEARCH_QUERY = `
  query SearchProducts($query: String!) {
    products(first: 3, query: $query) {
      edges {
        node {
          id
          title
          variants(first: 5) {
            edges { node { id title price } }
          }
        }
      }
    }
  }
`;

export async function findBestVariant(productQuery: string) {
  const escaped = productQuery.replace(/['"]/g, "");
  const data = await shopifyGraphQL<ProductSearchResult>(PRODUCT_SEARCH_QUERY, {
    query: `title:*${escaped}*`,
  });

  const firstProduct = data.products.edges[0]?.node;
  if (!firstProduct) return null;

  const firstVariant = firstProduct.variants.edges[0]?.node;
  if (!firstVariant) return null;

  return {
    variantId: firstVariant.id,
    title:
      firstVariant.title === "Default Title"
        ? firstProduct.title
        : `${firstProduct.title} - ${firstVariant.title}`,
    price: firstVariant.price,
  };
}

export async function matchLineItems(items: ParsedOrderItem[]): Promise<MatchedLineItem[]> {
  const matched: MatchedLineItem[] = [];
  for (const item of items) {
    const variant = await findBestVariant(item.product_query);
    if (variant) {
      matched.push({
        requested: item,
        matchedVariantId: variant.variantId,
        matchedTitle: variant.title,
        matchedPrice: variant.price,
        unmatched: false,
      });
    } else {
      matched.push({ requested: item, unmatched: true });
    }
  }
  return matched;
}

interface DraftOrderCreateResult {
  draftOrderCreate: {
    draftOrder: {
      id: string;
      name: string;
      invoiceUrl: string;
      totalPrice: string;
    } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

const DRAFT_ORDER_CREATE_MUTATION = `
  mutation CreateDraftOrder($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
        totalPrice
      }
      userErrors { field message }
    }
  }
`;

export async function createDraftOrder(
  matchedItems: MatchedLineItem[],
  note: string
): Promise<{ name: string; invoiceUrl: string; totalPrice: string }> {
  const lineItems = matchedItems
    .filter((m) => !m.unmatched)
    .map((m) => ({ variantId: m.matchedVariantId, quantity: m.requested.quantity }));

  const unmatchedItems = matchedItems
    .filter((m) => m.unmatched)
    .map((m) => ({
      title: `${m.requested.product_query} (unmatched - needs manual review)`,
      quantity: m.requested.quantity,
      originalUnitPrice: "0.00",
      requiresShipping: false,
      taxable: false,
    }));

  const data = await shopifyGraphQL<DraftOrderCreateResult>(DRAFT_ORDER_CREATE_MUTATION, {
    input: {
      lineItems: [...lineItems, ...unmatchedItems],
      note,
    },
  });

  const { draftOrder, userErrors } = data.draftOrderCreate;
  if (userErrors.length > 0 || !draftOrder) {
    throw new Error(`Draft order creation failed: ${JSON.stringify(userErrors)}`);
  }

  return draftOrder;
}
