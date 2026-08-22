import Anthropic from "@anthropic-ai/sdk";
import { model } from "../config/env.js";
import { systemPrompt } from "./prompt.js";
import { TOOLS, dispatch } from "./tools/index.js";

/**
 * The agent loop.
 *
 * One conversation per sender, held in memory. Restarting drops history, which is
 * the right trade here: a stale pending order surviving a restart would be worse
 * than losing context, and the approval gate expires in 15 minutes anyway.
 */

const MAX_TURNS = 8;
const HISTORY_LIMIT = 40;

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const histories = new Map<string, Anthropic.MessageParam[]>();

function history(sender: string): Anthropic.MessageParam[] {
  let h = histories.get(sender);
  if (!h) histories.set(sender, (h = []));
  return h;
}

export async function ask(sender: string, message: string): Promise<string> {
  const messages = history(sender);
  messages.push({ role: "user", content: message });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await getClient().messages.create({
      model: model(),
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      // The prompt is stable for the life of the process; only the conversation
      // below it varies, so this breakpoint caches the whole rules preamble.
      system: [
        { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } },
      ],
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      trim(messages);
      return textOf(response) || "(no reply)";
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      results.push(await runTool(block, sender));
    }
    messages.push({ role: "user", content: results });
  }

  trim(messages);
  return "That took too many steps and I stopped. Ask me again more specifically.";
}

async function runTool(
  block: Anthropic.ToolUseBlock,
  sender: string
): Promise<Anthropic.ToolResultBlockParam> {
  try {
    const result = await dispatch(block.name, block.input as Record<string, unknown>, sender);
    return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
  } catch (err) {
    // Surfaced to the model as an error result rather than thrown, so it can tell
    // the owner what failed instead of the turn dying silently.
    return {
      type: "tool_result",
      tool_use_id: block.id,
      is_error: true,
      content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
    };
  }
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Keep history bounded, always cutting at a user message so tool pairs stay intact. */
function trim(messages: Anthropic.MessageParam[]): void {
  if (messages.length <= HISTORY_LIMIT) return;
  const cut = messages.findIndex((m, i) => i >= messages.length - HISTORY_LIMIT && m.role === "user");
  if (cut > 0) messages.splice(0, cut);
}

/** Test seam. */
export function resetHistories(): void {
  histories.clear();
}
