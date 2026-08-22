import { callOpsTool } from "./ops/opsBridge.js";
import { shopifyGraphQL } from "./shopify/client.js";
import { listFiles, resolvePath, findEntry } from "./ops/files.js";

/**
 * Startup self-check.
 *
 * A service that reports "Running" while it cannot reach the ledger is not up,
 * and must not look up. Windows only knows whether the process is alive, so this
 * is what turns that into something meaningful in the log.
 *
 * Deliberately non-fatal: a bridge that is briefly down should not stop the
 * assistant answering file requests, and it may recover on its own. The rule is
 * that failures are loud, not that they are fatal.
 */

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function checkOpsBridge(): Promise<Check> {
  const result = await callOpsTool("get_rules_version");
  if (!result.ran) {
    return { name: "ops bridge", ok: false, detail: result.reason ?? "did not run" };
  }
  return { name: "ops bridge", ok: true, detail: "facts.py reachable" };
}

async function checkShopify(): Promise<Check> {
  try {
    const data = await shopifyGraphQL<{ shop: { name: string } }>("{ shop { name } }");
    return { name: "shopify", ok: true, detail: `connected to ${data.shop.name}` };
  } catch (err) {
    // This check also exercises the client-credentials token exchange, so it is
    // the first place a bad client ID or secret shows up. "Cannot reach Shopify"
    // and "Shopify rejected the credentials" need different fixes — say which.
    const message = err instanceof Error ? err.message : String(err);
    const credentialProblem = /token request failed|CLIENT_ID|CLIENT_SECRET/i.test(message);
    return {
      name: "shopify",
      ok: false,
      detail: credentialProblem ? `credentials rejected — ${message}` : message,
    };
  }
}

/**
 * Check the registry points at files that exist.
 *
 * A missing file only shows up when someone asks for it, which is exactly the
 * moment it is least convenient to discover — so it is checked at boot instead.
 */
async function checkRegistry(): Promise<Check> {
  const { access } = await import("node:fs/promises");
  const missing: string[] = [];

  for (const { key } of listFiles()) {
    const entry = findEntry(key);
    if (!entry) continue;
    try {
      await access(resolvePath(entry));
    } catch {
      missing.push(key);
    }
  }

  return missing.length === 0
    ? { name: "file registry", ok: true, detail: `${listFiles().length} files present` }
    : { name: "file registry", ok: false, detail: `missing: ${missing.join(", ")}` };
}

export async function selfCheck(): Promise<boolean> {
  const checks = await Promise.all([checkOpsBridge(), checkShopify(), checkRegistry()]);

  for (const check of checks) {
    const mark = check.ok ? "OK  " : "FAIL";
    console.log(`[startup] ${mark} ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.error(
      `[startup] ${failed.length} of ${checks.length} checks failed. The assistant is serving, ` +
        `but will report "could not check" for anything relying on: ${failed.map((f) => f.name).join(", ")}.`
    );
    return false;
  }

  console.log("[startup] All checks passed.");
  return true;
}
