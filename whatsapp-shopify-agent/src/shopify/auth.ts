/**
 * Shopify access tokens via the client credentials grant.
 *
 * Shopify stopped allowing new admin-created custom apps on 1 January 2026, so
 * there is no long-lived shpat_ token to paste into .env any more. Apps exchange
 * a client ID and secret for a token that is valid for 24 hours and must be
 * re-requested after that.
 *
 * That expiry is the whole reason this file exists. A static token would work
 * for a day and then fail — and it would fail invisibly, looking like the
 * assistant had simply stopped knowing anything about Shopify.
 */

const REFRESH_MARGIN_MS = 60 * 1000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | undefined;
let inFlight: Promise<CachedToken> | undefined;

export function shopifyDomain(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("SHOPIFY_STORE_DOMAIN must be set");
  return domain;
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set. Find them in the Shopify " +
        "Dev Dashboard under your app > Settings."
    );
  }
  return { clientId, clientSecret };
}

async function requestToken(): Promise<CachedToken> {
  const { clientId, clientSecret } = credentials();

  const res = await fetch(`https://${shopifyDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 401 here means the credentials themselves are wrong, which is a different
    // problem from the store being unreachable — say which.
    const hint =
      res.status === 401 || res.status === 400
        ? " Check the client ID and secret, and that the app is installed on this store."
        : "";
    throw new Error(`Shopify token request failed (${res.status}): ${detail}${hint}`);
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error(`Shopify token response had no access_token: ${JSON.stringify(body)}`);
  }

  // Default to an hour if expires_in is absent: short enough to be safe, long
  // enough not to hammer the endpoint.
  const lifetimeMs = (body.expires_in ?? 3600) * 1000;
  return { token: body.access_token, expiresAt: Date.now() + lifetimeMs };
}

/**
 * A valid token, fetching or refreshing as needed.
 *
 * Refreshes a minute early so a request never leaves carrying a token that
 * lapses in flight, and shares one in-flight request between concurrent callers
 * rather than firing one exchange per caller.
 */
export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.token;
  }

  inFlight ??= requestToken()
    .then((fresh) => (cached = fresh))
    .finally(() => {
      inFlight = undefined;
    });

  return (await inFlight).token;
}

/** Drop the cached token so the next call fetches a fresh one. */
export function invalidateToken(): void {
  cached = undefined;
}

/** Test seam. */
export function resetAuth(): void {
  cached = undefined;
  inFlight = undefined;
}
