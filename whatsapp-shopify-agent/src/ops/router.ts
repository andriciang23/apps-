import { ownerNumbers } from "../config/env.js";
import { confirm, looksAffirmative, pendingSummary } from "./approval.js";
import { ask } from "./assistant.js";

/**
 * The allowlist gate.
 *
 * With the customer lane parked, this is the entire security model: an
 * unrecognised sender reaches no tool, no ledger and no file. It fails closed —
 * an empty or malformed allowlist admits nobody rather than everybody.
 */

export function isOwner(from: string): boolean {
  return ownerNumbers().has(from.replace(/\D/g, ""));
}

export async function handleOwnerMessage(from: string, text: string): Promise<string> {
  // A bare "yes" is matched here, in code, rather than left to the model to
  // interpret. Approval is the one decision that must not depend on the model
  // reading the room correctly.
  if (looksAffirmative(text) && pendingSummary(from)) {
    confirm(from);
    return ask(from, `${text} — approved, create it now.`);
  }
  return ask(from, text);
}
