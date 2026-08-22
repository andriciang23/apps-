import { getAccessToken, invalidateToken, shopifyDomain } from "./auth.js";

const API_VERSION = "2026-07";

/**
 * Call the Admin GraphQL API.
 *
 * Retries once on a 401 with a fresh token. Tokens from the client credentials
 * grant expire after 24 hours, and a token can also be cut short by the app's
 * scopes changing or the app being reinstalled — so a 401 is an expected event
 * to recover from, not an error to surface. A second 401 is real and is raised.
 */
export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const url = `https://${shopifyDomain()}/admin/api/${API_VERSION}/graphql.json`;

  const send = async (token: string) =>
    fetch(url, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

  let res = await send(await getAccessToken());

  if (res.status === 401) {
    invalidateToken();
    res = await send(await getAccessToken());
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) {
    throw new Error(`Shopify GraphQL error (${res.status}): ${JSON.stringify(json.errors ?? json)}`);
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

