import Anthropic from "@anthropic-ai/sdk";
import type { ParsedOrder } from "./types.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY must be set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const EXTRACT_ORDER_TOOL: Anthropic.Tool = {
  name: "extract_order",
  description: "Extract structured order details from a customer's WhatsApp message.",
  input_schema: {
    type: "object",
    properties: {
      is_order: {
        type: "boolean",
        description: "True if this message contains a product order request, false otherwise (e.g. greeting, question, unrelated chat).",
      },
      customer_name: {
        type: "string",
        description: "Customer's name if mentioned in the message, otherwise omit.",
      },
      items: {
        type: "array",
        description: "List of ordered items. Empty if is_order is false.",
        items: {
          type: "object",
          properties: {
            product_query: {
              type: "string",
              description: "The product name/description as the customer described it, used to search the catalog.",
            },
            quantity: {
              type: "number",
              description: "Quantity requested. Default to 1 if not specified.",
            },
          },
          required: ["product_query", "quantity"],
        },
      },
      shipping_address: {
        type: "string",
        description: "Shipping address if mentioned, otherwise omit.",
      },
      notes: {
        type: "string",
        description: "Any other relevant notes (e.g. color, size, special requests), otherwise omit.",
      },
    },
    required: ["is_order", "items"],
  },
};

export async function parseOrderMessage(
  messageText: string,
  whatsappProfileName?: string
): Promise<ParsedOrder> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const response = await getClient().messages.create({
    model,
    max_tokens: 1024,
    system:
      "You extract structured order information from informal WhatsApp messages sent to a small business. " +
      "Customers often write in casual, abbreviated language and may mix languages. " +
      "Use the extract_order tool to report your findings. If the message is not an order, set is_order to false.",
    messages: [
      {
        role: "user",
        content: `WhatsApp sender profile name: ${whatsappProfileName ?? "unknown"}\n\nMessage:\n${messageText}`,
      },
    ],
    tools: [EXTRACT_ORDER_TOOL],
    tool_choice: { type: "tool", name: "extract_order" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { is_order: false, items: [] };
  }

  const input = toolUse.input as Partial<ParsedOrder>;
  return {
    is_order: Boolean(input.is_order),
    customer_name: input.customer_name,
    items: input.items ?? [],
    shipping_address: input.shipping_address,
    notes: input.notes,
  };
}
