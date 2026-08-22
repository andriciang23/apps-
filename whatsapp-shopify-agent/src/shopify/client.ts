const API_VERSION = "2026-07";

function getConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!domain || !token) {
    throw new Error("SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN must be set");
  }
  return { domain, token };
}

export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const { domain, token } = getConfig();
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data as T;
}

/* ── Sizes ─────────────────────────────────────────────────────────────────── */

/** Grams from a size string. Handles "500g", "1kg", "2 kg", "250 g". */
export function parseGrams(text: string): number | undefined {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/);
  if (!m) return undefined;
  const value = Number(m[1]);
  return m[2] === "kg" ? value * 1000 : value;
}

