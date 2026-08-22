import type Anthropic from "@anthropic-ai/sdk";

/** Tool definitions as the model sees them. Behaviour lives in dispatch.ts. */

const SKU_SCHEMA = {
  type: "object" as const,
  properties: { sku: { type: "string", description: "SKU or product name. Omit for all." } },
  additionalProperties: false,
};

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_facts",
    description:
      "Live stock, cost, margin and reorder flags. The only permitted source for these figures. " +
      "Returns {ok, ran, data, reason}; ran=false means the check did NOT run and the answer is unknown.",
    input_schema: SKU_SCHEMA,
  },
  {
    name: "get_velocity",
    description:
      "Days of cover measured from real drawdown, plus the ONE ORDER FROM ZERO flag. Use for every " +
      "cover claim; the ledger's own demand column is Shopify-only and overstates cover.",
    input_schema: SKU_SCHEMA,
  },
  {
    name: "find_customer",
    description:
      "Look up a Shopify customer. Check defaultAddress before proposing any draft order — a customer " +
      "without one cannot have a draft created.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Customer name, company or email." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_variant",
    description:
      "Find catalogue variants matching a product and size. If ambiguous is true, ask which one — never pick.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name, shorthand already expanded." },
        size: { type: "string", description: 'Size such as "500g" or "1kg".' },
        format: { type: "string", description: 'Format such as "Refill" or "Tin".' },
      },
      required: ["product"],
      additionalProperties: false,
    },
  },
  {
    name: "create_draft_order",
    description:
      "Create a Shopify draft order. Requires the owner's approval of this exact order first: call it " +
      "once to get the summary to show them, then again unchanged after they say yes.",
    input_schema: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              variantId: { type: "string" },
              quantity: { type: "number" },
              title: { type: "string" },
              price: { type: "string" },
            },
            required: ["variantId", "quantity", "title", "price"],
            additionalProperties: false,
          },
        },
      },
      required: ["customerId", "lineItems"],
      additionalProperties: false,
    },
  },
  {
    name: "send_file",
    description:
      "Send a file from the registry to the owner. Only registry keys work — file paths are never accepted. " +
      "Call with no key to list what is available.",
    input_schema: {
      type: "object",
      properties: { key: { type: "string", description: "Registry key or alias." } },
      additionalProperties: false,
    },
  },
];
