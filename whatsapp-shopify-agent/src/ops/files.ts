import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import registry from "../../files.registry.json" with { type: "json" };

/**
 * The file registry.
 *
 * The assistant can send only what is listed here, by key. It never takes a path
 * from a message — a chat channel that will fetch an arbitrary path on request is
 * an exfiltration hole, and the files in scope include the wholesale pricelist and
 * the Ombak pitch deck.
 *
 * Two independent defences, because one is never enough: the key must be in the
 * registry, AND the resolved path must sit inside the registry root.
 */

export interface RegistryEntry {
  key: string;
  aliases: string[];
  path: string;
  label: string;
  staleAgainst?: string;
}

const ENTRIES = registry.files as RegistryEntry[];

/** WhatsApp Cloud API caps documents at 100 MB. */
const MAX_BYTES = 100 * 1024 * 1024;

export function listFiles(): { key: string; label: string }[] {
  return ENTRIES.map(({ key, label }) => ({ key, label }));
}

/** Exact key first, then aliases, then a contained-word match. Never fuzzy. */
export function findEntry(query: string): RegistryEntry | undefined {
  const q = query.trim().toLowerCase();
  return (
    ENTRIES.find((e) => e.key.toLowerCase() === q) ??
    ENTRIES.find((e) => e.aliases.some((a) => a.toLowerCase() === q)) ??
    ENTRIES.find((e) => e.aliases.some((a) => q.includes(a.toLowerCase())))
  );
}

function registryRoot(): string {
  const root = process.env.FILE_REGISTRY_ROOT;
  if (!root) throw new Error("FILE_REGISTRY_ROOT is not set");
  return path.resolve(root);
}

/**
 * Resolve a registry entry to an absolute path inside the root.
 *
 * The containment check is what stops a registry entry containing "../.." — the
 * registry is trusted, but trusted-and-verified costs nothing here.
 */
export function resolvePath(entry: RegistryEntry): string {
  const root = registryRoot();
  const full = path.resolve(root, entry.path);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`registry entry ${entry.key} escapes the registry root`);
  }
  return full;
}

export interface LoadedFile {
  buffer: Buffer;
  filename: string;
  lastModified: string;
  staleAgainst?: string;
}

/** Read a registered file and report its age. Freshness is never optional. */
export async function loadFile(entry: RegistryEntry): Promise<LoadedFile> {
  const full = resolvePath(entry);
  const info = await stat(full);
  if (info.size > MAX_BYTES) {
    throw new Error(`${entry.label} is ${Math.round(info.size / 1e6)} MB — over WhatsApp's 100 MB limit`);
  }
  return {
    buffer: await readFile(full),
    filename: path.basename(full),
    lastModified: info.mtime.toISOString().slice(0, 10),
    staleAgainst: entry.staleAgainst,
  };
}
