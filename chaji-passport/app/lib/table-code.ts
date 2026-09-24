// Printed QR codes on YAMA Café tables carry a signed table code so stamp URLs
// can't be guessed or enumerated from home. Format: "<table>.<sig>".

import { createHmac, timingSafeEqual } from "node:crypto";

const SIG_LENGTH = 12;
const TABLE_RE = /^[a-z0-9-]{1,24}$/;

function sign(table: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`table:${table}`)
    .digest("base64url")
    .slice(0, SIG_LENGTH);
}

export function makeTableCode(table: string, secret: string) {
  if (!TABLE_RE.test(table)) throw new Error(`Invalid table id: ${table}`);
  if (!secret) throw new Error("Missing table-code secret");
  return `${table}.${sign(table, secret)}`;
}

/** Returns the table id if the code is genuine, otherwise null. */
export function verifyTableCode(code: string | null | undefined, secret: string) {
  if (!code || !secret) return null;
  const dot = code.lastIndexOf(".");
  if (dot <= 0) return null;
  const table = code.slice(0, dot);
  const given = Buffer.from(code.slice(dot + 1));
  if (!TABLE_RE.test(table)) return null;
  const expected = Buffer.from(sign(table, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return table;
}
