import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ownerNumbers, validateEnv } from "../config/env.js";
import { consume, confirm, fingerprint, looksAffirmative, reset, stage } from "../ops/approval.js";
import { findEntry, resolvePath } from "../ops/files.js";
import { renderStockOut } from "../ops/orders.js";
import { verifySignature } from "../server.js";
import { forcedFormat, normaliseSize, expand } from "../config/shorthand.js";
import { parseGrams } from "../shopify/client.js";

const SECRET = "test-app-secret";

function signedRequest(body: string, signature?: string) {
  return {
    rawBody: Buffer.from(body),
    header: (name: string) =>
      name.toLowerCase() === "x-hub-signature-256" ? signature : undefined,
  } as never;
}

function sign(body: string, secret = SECRET): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("signature verification", () => {
  before(() => {
    process.env.META_APP_SECRET = SECRET;
  });

  it("accepts a valid signature", () => {
    const body = '{"object":"whatsapp_business_account"}';
    assert.equal(verifySignature(signedRequest(body, sign(body))), true);
  });

  it("rejects a signature made with the wrong secret", () => {
    const body = '{"object":"whatsapp_business_account"}';
    assert.equal(verifySignature(signedRequest(body, sign(body, "wrong"))), false);
  });

  it("returns false, not a throw, on a wrong-length signature", () => {
    // timingSafeEqual throws on unequal lengths and the header is attacker
    // controlled, so this must be a clean 401 and never an uncaught 500.
    const body = "{}";
    assert.doesNotThrow(() => verifySignature(signedRequest(body, "sha256=deadbeef")));
    assert.equal(verifySignature(signedRequest(body, "sha256=deadbeef")), false);
  });

  it("fails closed when META_APP_SECRET is unset", () => {
    delete process.env.META_APP_SECRET;
    const body = "{}";
    assert.equal(verifySignature(signedRequest(body, sign(body))), false);
    process.env.META_APP_SECRET = SECRET;
  });

  it("lists META_APP_SECRET as required at startup", () => {
    delete process.env.META_APP_SECRET;
    assert.ok(validateEnv().includes("META_APP_SECRET"));
    process.env.META_APP_SECRET = SECRET;
  });
});

describe("owner allowlist", () => {
  it("matches on digits regardless of formatting", () => {
    process.env.OWNER_PHONE_NUMBERS = "+60 12-345 6789, 60198887777";
    const owners = ownerNumbers();
    assert.ok(owners.has("60123456789"));
    assert.ok(owners.has("60198887777"));
  });

  it("never matches a prefix or a substring", () => {
    process.env.OWNER_PHONE_NUMBERS = "60123456789";
    const owners = ownerNumbers();
    assert.equal(owners.has("6012345"), false);
    assert.equal(owners.has("601234567890"), false);
  });

  it("admits nobody when the allowlist is empty", () => {
    process.env.OWNER_PHONE_NUMBERS = "";
    assert.equal(ownerNumbers().size, 0);
  });
});

describe("approval gate", () => {
  const sender = "60123456789";
  const order = { customerId: "gid://shopify/Customer/1", lineItems: [{ variantId: "v1", quantity: 2 }] };

  before(() => reset());

  it("refuses a write with nothing pending", () => {
    reset();
    const result = consume(sender, fingerprint(order));
    assert.equal(result.allowed, false);
  });

  it("refuses a staged but unconfirmed proposal", () => {
    reset();
    stage(sender, fingerprint(order), "summary");
    assert.equal(consume(sender, fingerprint(order)).allowed, false);
  });

  it("allows exactly once after confirmation", () => {
    reset();
    stage(sender, fingerprint(order), "summary");
    confirm(sender);
    assert.equal(consume(sender, fingerprint(order)).allowed, true);
    // Replay must not succeed — approval is single use.
    assert.equal(consume(sender, fingerprint(order)).allowed, false);
  });

  it("refuses when the order changed after approval", () => {
    reset();
    stage(sender, fingerprint(order), "summary");
    confirm(sender);
    const tampered = { ...order, lineItems: [{ variantId: "v1", quantity: 99 }] };
    const result = consume(sender, fingerprint(tampered));
    assert.equal(result.allowed, false);
    assert.match(result.allowed ? "" : result.reason, /changed/);
  });

  it("fingerprints independently of key order", () => {
    assert.equal(
      fingerprint({ a: 1, b: [{ x: 1, y: 2 }] }),
      fingerprint({ b: [{ y: 2, x: 1 }] as unknown as object, a: 1 })
    );
  });

  it("treats only unambiguous affirmatives as yes", () => {
    for (const yes of ["yes", "Yes", "ok", "go ahead", "confirm", "boleh"]) {
      assert.equal(looksAffirmative(yes), true, yes);
    }
    for (const no of ["yes but make it 3", "no", "yes?", "actually change it", ""]) {
      assert.equal(looksAffirmative(no), false, no);
    }
  });
});

describe("file registry", () => {
  before(() => {
    process.env.FILE_REGISTRY_ROOTS = "/srv/wholesale;/srv/decks";
  });

  it("resolves a known key and its aliases", () => {
    assert.equal(findEntry("wholesale-pricelist")?.key, "wholesale-pricelist");
    assert.equal(findEntry("pricelist")?.key, "wholesale-pricelist");
    assert.equal(findEntry("send me the catalogue")?.key, "profile-catalogue");
  });

  it("refuses anything not in the registry", () => {
    assert.equal(findEntry("C:\\Claude\\PERMANENT_RULES.md"), undefined);
    assert.equal(findEntry("../../etc/passwd"), undefined);
    assert.equal(findEntry("ledger.xlsx"), undefined);
  });

  it("accepts a path inside any permitted root", () => {
    assert.equal(
      resolvePath({ key: "ok", aliases: [], path: "/srv/decks/ombak.pdf", label: "ok" }),
      "/srv/decks/ombak.pdf"
    );
  });

  it("refuses a path outside every permitted root", () => {
    for (const escape of ["/etc/passwd", "/srv/wholesale/../../etc/passwd", "/srv/other/x.pdf"]) {
      assert.throws(
        () => resolvePath({ key: "evil", aliases: [], path: escape, label: "evil" }),
        /resolves outside every permitted root/,
        escape
      );
    }
  });

  it("refuses a root that is exactly the target, not a parent", () => {
    // A bare root must not itself be sendable.
    assert.throws(
      () => resolvePath({ key: "root", aliases: [], path: "/srv/decks", label: "root" }),
      /resolves outside every permitted root/
    );
  });

  after(() => {
    delete process.env.FILE_REGISTRY_ROOTS;
  });
});

describe("catalogue rules", () => {
  it("parses sizes in g and kg", () => {
    assert.equal(parseGrams("500g"), 500);
    assert.equal(parseGrams("1kg"), 1000);
    assert.equal(parseGrams("2 kg"), 2000);
    assert.equal(parseGrams("Refill"), undefined);
  });

  it("forces Refill for Kitsune 30g and 100g, never the Tin", () => {
    assert.equal(forcedFormat("Kitsune Matcha", "30g"), "Refill");
    assert.equal(forcedFormat("Kitsune Matcha", "100g"), "Refill");
    assert.equal(forcedFormat("Kitsune Matcha", "500g"), undefined);
    assert.equal(forcedFormat("Kimidori Matcha", "30g"), undefined);
  });

  it("corrects an obvious size typo but not a genuine choice", () => {
    assert.equal(normaliseSize(509), 500);
    assert.equal(normaliseSize(500), 500);
    assert.equal(normaliseSize(300), undefined);
  });

  it("keeps HJPDDR and hjdr apart", () => {
    // Powder vs loose leaf. Confusing these puts the wrong tea in an order.
    assert.notEqual(expand("hjpddr"), expand("hjdr"));
    assert.match(expand("hjpddr"), /Powder/);
    assert.match(expand("hjdr"), /loose leaf/);
  });
});

describe("stock-out summary", () => {
  it("renders plain text with totals and no table", () => {
    const out = renderStockOut(
      [
        { variantId: "v1", quantity: 2, title: "Kimidori 500g", price: "180.00" },
        { variantId: "v2", quantity: 1, title: "Takamidori 250g", price: "95.00" },
        { variantId: "v1", quantity: 3, title: "Kimidori 500g", price: "180.00" },
      ],
      new Date("2026-08-22T00:00:00Z")
    );
    assert.equal(out, "Stock out - 2026-08-22\nKimidori 500g x5\nTakamidori 250g x1");
    assert.equal(out.includes("|"), false);
  });
});

describe("dispatch wiring", () => {
  it("applies the Kohaku skip rule through dispatch, before any network call", async () => {
    // Goes through dispatch rather than calling the helper directly: the helpers
    // were once exported, tested and never actually reached by the pipeline.
    const { dispatch } = await import("../ops/tools/index.js");
    const result = (await dispatch(
      "find_variant",
      { product: "kohaku 20g" },
      "60123456789"
    )) as { skip?: boolean; matches: unknown[] };

    assert.equal(result.skip, true);
    assert.deepEqual(result.matches, []);
  });

  it("rejects an unknown tool name", async () => {
    const { dispatch } = await import("../ops/tools/index.js");
    const result = (await dispatch("drop_ledger", {}, "60123456789")) as { error?: string };
    assert.match(result.error ?? "", /unknown tool/);
  });
});
