import { createHash } from "node:crypto";

/**
 * The write gate.
 *
 * Approval is bound to a fingerprint of the exact order the owner was shown, not
 * to a bearer token the model carries around. That closes the gap a token leaves:
 * if the model changes a quantity, a price or a customer after the owner said yes,
 * the fingerprint no longer matches and the write is refused. The model cannot
 * approve its own work, and it cannot approve something other than what was read.
 */

const TTL_MS = 15 * 60 * 1000;

interface Pending {
  fingerprint: string;
  summary: string;
  confirmed: boolean;
  used: boolean;
  stagedAt: number;
}

const pending = new Map<string, Pending>();

/** Stable across key order so the same order always fingerprints the same. */
export function fingerprint(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex").slice(0, 32);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

function isExpired(p: Pending): boolean {
  return Date.now() - p.stagedAt > TTL_MS;
}

/** Record what the owner is about to be shown, replacing any earlier proposal. */
export function stage(sender: string, fp: string, summary: string): void {
  pending.set(sender, {
    fingerprint: fp,
    summary,
    confirmed: false,
    used: false,
    stagedAt: Date.now(),
  });
}

/**
 * Affirmatives are matched strictly and only against a whole message.
 *
 * A missed yes costs one extra round trip. A false positive creates an order
 * nobody approved, so anything ambiguous ("yes but make it 3") deliberately
 * fails to match and goes back to the model to re-propose.
 */
const AFFIRMATIVE = /^(y|ya|yes|yep|yes please|ok|okay|confirm|confirmed|go|go ahead|proceed|send it|do it|betul|boleh)[.!]?$/i;

export function looksAffirmative(text: string): boolean {
  return AFFIRMATIVE.test(text.trim());
}

/** Mark a live proposal approved. Returns false if there is nothing to approve. */
export function confirm(sender: string): boolean {
  const p = pending.get(sender);
  if (!p || p.used || isExpired(p)) return false;
  p.confirmed = true;
  return true;
}

export function pendingSummary(sender: string): string | undefined {
  const p = pending.get(sender);
  return p && !p.used && !isExpired(p) ? p.summary : undefined;
}

export type ConsumeResult = { allowed: true } | { allowed: false; reason: string };

/** Spend an approval. Single use — a replay after this returns not-approved. */
export function consume(sender: string, fp: string): ConsumeResult {
  const p = pending.get(sender);
  if (!p) return { allowed: false, reason: "no proposal is pending" };
  if (p.used) return { allowed: false, reason: "that approval was already used" };
  if (isExpired(p)) return { allowed: false, reason: "the approval expired after 15 minutes" };
  if (!p.confirmed) return { allowed: false, reason: "the owner has not approved this yet" };
  if (p.fingerprint !== fp) {
    return { allowed: false, reason: "the order changed since it was approved" };
  }
  p.used = true;
  return { allowed: true };
}

/** Test seam. */
export function reset(): void {
  pending.clear();
}
