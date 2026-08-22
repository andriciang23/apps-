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

function registryRoots(): string[] {
  const raw = process.env.FILE_REGISTRY_ROOTS;
  if (!raw?.trim()) throw new Error("FILE_REGISTRY_ROOTS is not set");
  // Semicolon-separated: Windows paths contain colons, so a colon cannot separate them.
  const roots = raw
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => path.resolve(r));
  if (roots.length === 0) throw new Error("FILE_REGISTRY_ROOTS is empty");
  return roots;
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Resolve a registry entry to an absolute path inside one of the permitted roots.
 *
 * Several roots rather than one because the sendable files genuinely live on
 * different drives — the wholesale pricelist on W:, decks on C:. The containment
 * check is the second line of defence behind the registry allowlist: it stops a
 * registry entry containing "..\..", which the registry being trusted does not
 * by itself rule out.
 */
export function resolvePath(entry: RegistryEntry): string {
  const roots = registryRoots();
  const full = path.resolve(entry.path);

  if (!roots.some((root) => isInside(root, full))) {
    throw new Error(
      `registry entry ${entry.key} resolves outside every permitted root ` +
        `(${roots.join("; ")})`
    );
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
