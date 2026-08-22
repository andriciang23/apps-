# HojichaYa Ops Assistant

A WhatsApp chat that knows the business. Andri and Mun Yan message a dedicated
number; it answers stock questions from the ledger, prepares Shopify draft orders
behind an approval gate, and sends registered files.

It is **not** a customer-facing bot. Anyone not on the owner allowlist gets no
reply and reaches no tool.

## What it does

| Ask | It does |
|---|---|
| "how's kimidori" | Quantity and time basis from `facts.py`, days of cover and ONE-ORDER-FROM-ZERO from `velocity.py` |
| "order for Kopi Lab: 2x kimidori 500g" | Resolves customer and variants, shows the parse, waits for a yes, then creates the draft and posts the stock-out summary |
| "send me the wholesale pricelist" | Sends the registered file, leading with its date |

## Architecture

```
WhatsApp ──► /webhook ──► signature verify ──► owner allowlist ──► assistant (Claude)
                                                    │                    │
                                            not owner: silence           ├── ops-mcp ──► facts.py, velocity.py
                                                                         ├── Shopify ──► reads; draft create (gated)
                                                                         └── registry ──► WhatsApp document
```

## The four gates

Everything that must hold is enforced in code, not asked of the model. A prompt
instruction is a request; a code gate is a guarantee.

1. **Signature** (`server.ts`) — a missing `META_APP_SECRET` fails closed and the
   service refuses to start. Buffer lengths are compared before `timingSafeEqual`,
   which throws on mismatch against an attacker-controlled header.
2. **Allowlist** (`ops/router.ts`) — exact digit match. No prefix matching, and an
   empty allowlist admits nobody.
3. **Approval** (`ops/approval.ts`) — a draft order is written only after the owner
   approved *that exact order*. Approval is bound to a fingerprint of the payload
   they were shown, so changing a quantity after the yes invalidates it. Single
   use, 15-minute expiry. The model cannot approve its own work.
4. **Registry** (`ops/files.ts`) — only listed keys can be sent, and the resolved
   path must stay inside `FILE_REGISTRY_ROOT`. A path in a message is never read.

## Rules encoded

From `PERMANENT_RULES.md`, in `ops/prompt.ts` and `config/shorthand.ts`:

- Numbers come from the tools, never from memory or a document; every figure
  states its time basis.
- `ran: false` means the check did **not happen** — unknown, never all-clear.
- Cover comes from `velocity.py`, never the ledger's Shopify-only demand column.
  ONE ORDER FROM ZERO is reported ahead of any cover figure.
- Shorthand is resolved in code. `HJPDDR` (powder) and `hjdr` (loose leaf) are
  different products and there is a test holding them apart.
- Kitsune 30g/100g is always Refill. Loose leaf defaults to 80g; powders have no
  default and must be asked about. Kohaku is always skipped.
- **§I**: every draft carries shipping *and* billing address from the customer's
  default address, asserted present in the mutation's own return. A customer
  without one is refused rather than given a broken draft — billing cannot be
  added after creation.
- The assistant never writes inventory. Ledger → Shopify stays one-way.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill it in. `META_APP_SECRET` and
   `OWNER_PHONE_NUMBERS` are required — startup fails without them.
3. Set up `ops-mcp/` (see `../ops-mcp/README.md`) and verify its numbers against
   the scripts run directly.
4. `npm run build && npm start`
5. Expose it. For a first test `cloudflared tunnel --url http://localhost:3000`
   is fine, but it issues a **new random URL each run** — set up a named tunnel
   before relying on it (`../scripts/README.md`), or every restart silently stops
   WhatsApp delivery.
6. Register the webhook with Meta: callback `https://<tunnel>/webhook`, your
   verify token, subscribe to `messages`.
7. Install as a service so it survives reboots: `../scripts/README.md`.

Shopify custom app scopes: `read_products`, `read_customers`, `read_inventory`,
`write_draft_orders`.

## Tests

`npm test` — 22 tests over the four gates plus the catalogue rules. They cover the
cases that cost money: wrong-length signatures, allowlist prefix matching,
approval replay and tampering, registry escape attempts, and HJPDDR vs hjdr.

## Verify before trusting it

- Ask "how's kimidori" and check the answer against `facts.py` and `velocity.py`
  run manually. Predict the answer first.
- Rename `facts.py` and confirm it says it could not check, rather than going quiet.
- Try `send me C:\Claude\PERMANENT_RULES.md` and confirm refusal.
- Propose an order, say yes, then confirm both address flags came back true.
- Propose an order for a customer with no default address and confirm nothing is
  created.

## Not built yet

- Voice note transcription (planned; stock updates while packing).
- Scheduled morning brief — needs an approved utility template to message first
  outside the 24-hour window (~RM 0.06/day).
- The **customer-facing** order bot. It was the original build and is parked, not
  deleted: `git show claude/whatsapp-shopify-agent-351uoz:whatsapp-shopify-agent/src/orderParser.ts`.
  Reviving it means moving the webhook to an always-on host, since a sleeping PC
  would drop customer orders.
