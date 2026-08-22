import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { OpsResult } from "../types.js";

/**
 * Client for the ops-mcp server, which wraps facts.py / velocity.py.
 *
 * Every failure path here returns ran:false with a reason rather than throwing,
 * so a bridge that is down is reported to the owner as "could not check" instead
 * of surfacing as an error the model might paper over.
 */

let client: Client | undefined;
let connecting: Promise<Client> | undefined;

async function connect(): Promise<Client> {
  const command = process.env.OPS_MCP_PYTHON || "python";
  const script = process.env.OPS_MCP_SERVER;
  if (!script) throw new Error("OPS_MCP_SERVER is not set");

  const transport = new StdioClientTransport({
    command,
    args: [script],
    env: process.env as Record<string, string>,
  });

  const c = new Client({ name: "hojichaya-ops-assistant", version: "1.0.0" });
  await c.connect(transport);
  return c;
}

async function getClient(): Promise<Client> {
  if (client) return client;
  connecting ??= connect().then((c) => (client = c));
  try {
    return await connecting;
  } catch (err) {
    connecting = undefined; // let the next call retry rather than fail forever
    throw err;
  }
}

export async function callOpsTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<OpsResult> {
  try {
    const c = await getClient();
    const res = await c.callTool({ name, arguments: args });
    const first = (res.content as Array<{ type: string; text?: string }> | undefined)?.[0];
    if (first?.type !== "text" || !first.text) {
      return { ok: false, ran: false, reason: `${name} returned no readable content` };
    }
    return JSON.parse(first.text) as OpsResult;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, ran: false, reason: `ops bridge unreachable: ${reason}` };
  }
}

/** Test seam. */
export function resetBridge(): void {
  client = undefined;
  connecting = undefined;
}
