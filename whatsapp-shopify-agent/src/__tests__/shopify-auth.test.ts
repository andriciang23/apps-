import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getAccessToken, invalidateToken, resetAuth } from "../shopify/auth.js";

/**
 * Shopify tokens from the client credentials grant expire after 24 hours. These
 * tests exist because that failure would otherwise appear a full day after
 * deployment, look like the assistant had forgotten Shopify existed, and be
 * almost impossible to connect back to a token.
 */

const realFetch = globalThis.fetch;

interface Call {
  url: string;
  body: string;
}

let calls: Call[] = [];

function stubFetch(responder: (call: Call) => { status: number; json: unknown }) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: String(input), body: String(init?.body ?? "") };
    calls.push(call);
    const { status, json } = responder(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
      text: async () => JSON.stringify(json),
    } as Response;
  }) as typeof fetch;
}

function tokenResponse(token: string, expiresIn = 86399) {
  return { status: 200, json: { access_token: token, expires_in: expiresIn } };
}

beforeEach(() => {
  calls = [];
  resetAuth();
  process.env.SHOPIFY_STORE_DOMAIN = "hojichaya.myshopify.com";
  process.env.SHOPIFY_CLIENT_ID = "test-client-id";
  process.env.SHOPIFY_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  resetAuth();
});

describe("shopify token exchange", () => {
  it("posts client credentials to the store's token endpoint", async () => {
    stubFetch(() => tokenResponse("shpat_first"));
    const token = await getAccessToken();

    assert.equal(token, "shpat_first");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://hojichaya.myshopify.com/admin/oauth/access_token");

    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get("grant_type"), "client_credentials");
    assert.equal(body.get("client_id"), "test-client-id");
    assert.equal(body.get("client_secret"), "test-client-secret");
  });

  it("caches, so a second call does not hit the network", async () => {
    stubFetch(() => tokenResponse("shpat_cached"));
    assert.equal(await getAccessToken(), "shpat_cached");
    assert.equal(await getAccessToken(), "shpat_cached");
    assert.equal(calls.length, 1);
  });

  it("refetches once the token is near expiry", async () => {
    // expires_in of 30s is inside the 60s refresh margin, so the cached token is
    // already considered stale — this is the 24-hour expiry, compressed.
    let issued = 0;
    stubFetch(() => tokenResponse(`shpat_${++issued}`, 30));

    assert.equal(await getAccessToken(), "shpat_1");
    assert.equal(await getAccessToken(), "shpat_2");
    assert.equal(calls.length, 2);
  });

  it("shares one request between concurrent callers", async () => {
    let issued = 0;
    stubFetch(() => tokenResponse(`shpat_${++issued}`));

    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);

    assert.deepEqual(tokens, ["shpat_1", "shpat_1", "shpat_1"]);
    assert.equal(calls.length, 1, "concurrent callers must not each trigger an exchange");
  });

  it("fetches again after invalidateToken", async () => {
    let issued = 0;
    stubFetch(() => tokenResponse(`shpat_${++issued}`));

    assert.equal(await getAccessToken(), "shpat_1");
    invalidateToken();
    assert.equal(await getAccessToken(), "shpat_2");
    assert.equal(calls.length, 2);
  });

  it("explains a rejected credential rather than leaking the status alone", async () => {
    stubFetch(() => ({ status: 401, json: { error: "invalid_client" } }));
    await assert.rejects(getAccessToken(), /client ID and secret/);
  });

  it("recovers from a failed exchange instead of caching the failure", async () => {
    let attempt = 0;
    stubFetch(() => (++attempt === 1 ? { status: 500, json: {} } : tokenResponse("shpat_ok")));

    await assert.rejects(getAccessToken());
    assert.equal(await getAccessToken(), "shpat_ok");
  });

  it("refuses to run without credentials", async () => {
    delete process.env.SHOPIFY_CLIENT_SECRET;
    stubFetch(() => tokenResponse("never"));
    await assert.rejects(getAccessToken(), /SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET/);
  });
});

describe("admin API 401 recovery", () => {
  it("retries once with a fresh token, then gives up", async () => {
    const { shopifyGraphQL } = await import("../shopify/client.js");

    let issued = 0;
    stubFetch((call) => {
      if (call.url.includes("/admin/oauth/access_token")) {
        return tokenResponse(`shpat_${++issued}`);
      }
      return { status: 401, json: { errors: "unauthorized" } };
    });

    await assert.rejects(shopifyGraphQL("{ shop { name } }"), /401/);

    const graphqlCalls = calls.filter((c) => c.url.includes("graphql.json"));
    assert.equal(graphqlCalls.length, 2, "must retry exactly once, not loop");
    assert.equal(issued, 2, "the retry must use a newly fetched token");
  });

  it("succeeds on the retry when the token was merely stale", async () => {
    const { shopifyGraphQL } = await import("../shopify/client.js");

    let issued = 0;
    let graphqlAttempts = 0;
    stubFetch((call) => {
      if (call.url.includes("/admin/oauth/access_token")) {
        return tokenResponse(`shpat_${++issued}`);
      }
      graphqlAttempts++;
      return graphqlAttempts === 1
        ? { status: 401, json: { errors: "expired" } }
        : { status: 200, json: { data: { shop: { name: "HojichaYa" } } } };
    });

    const data = await shopifyGraphQL<{ shop: { name: string } }>("{ shop { name } }");
    assert.equal(data.shop.name, "HojichaYa");
    assert.equal(graphqlAttempts, 2);
  });
});
