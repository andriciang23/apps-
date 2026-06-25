# WhatsApp → Shopify Order Agent

Listens to your WhatsApp Business number, uses Claude to parse order messages
("2x red hoodie size M, ship to Jl. Sudirman"), matches the items against your
Shopify catalog, creates a **draft order** for you to review, and replies on
WhatsApp with a summary.

It never creates a real/paid order automatically — every order lands as a
Shopify draft order so you can confirm before it's final.

## How it works

```
WhatsApp message → Meta Cloud API webhook → Claude (extract order) →
Shopify product search → Shopify draft order → WhatsApp reply (summary)
```

## 1. Create a Shopify custom app (Admin API token)

1. Shopify Admin → Settings → Apps and sales channels → Develop apps →
   Create an app.
2. Configure Admin API scopes: `read_products`, `write_draft_orders`.
3. Install the app on your store and copy the **Admin API access token**.
4. Note your store domain, e.g. `your-store.myshopify.com`.

## 2. Create a Meta WhatsApp Cloud API app

1. Go to https://developers.facebook.com/apps and create an app, add the
   **WhatsApp** product.
2. In WhatsApp → API Setup you'll get a temporary **access token** and a
   **Phone Number ID**. For production, generate a permanent token under
   System Users (Business Settings → System Users → Generate Token, with
   `whatsapp_business_messaging` permission).
3. Note your **App Secret** (App Settings → Basic) — used to verify that
   incoming webhooks really come from Meta.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

| Variable | Where to get it |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta App → WhatsApp → API Setup (or System User permanent token) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App → WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Any string you make up — used during webhook setup |
| `META_APP_SECRET` | Meta App → Settings → Basic |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | From step 1 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |

## 4. Run locally

```bash
npm install
npm run dev
```

This starts the webhook server on `http://localhost:3000`. Expose it
publicly for Meta to reach (e.g. `ngrok http 3000`), then in Meta App →
WhatsApp → Configuration:

- Callback URL: `https://<your-tunnel>/webhook`
- Verify token: the same value as `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the `messages` webhook field.

## 5. Deploy

Build and run as a normal Node service on any host that can stay reachable
(Render, Fly.io, Railway, a VPS, etc.):

```bash
npm run build
npm start
```

Point the Meta webhook callback URL at your deployed `/webhook` endpoint.

## Test it

Send a WhatsApp message to your business number, e.g.:

> 2x blue t-shirt size L, 1x cap, ship to Jl. Merdeka 10 Jakarta

You should get a reply like:

```
Order received! Draft #D1234 created for review.

- Blue T-Shirt - L x2 @ 150000
- Cap x1 @ 80000

Total: 380000
Review: https://your-store.myshopify.com/.../draft_orders/.../invoice
```

Open the link to confirm/send invoice/convert to a real order.

## Notes & limitations (MVP)

- Only plain text messages are parsed; images/voice notes get a polite
  "please send as text" reply.
- Product matching uses a simple Shopify title search and picks the first
  matching product/variant. Ambiguous or unmatched items are added as a
  flagged $0 custom line item in the draft order so nothing is silently
  dropped — review before confirming.
- Message de-duplication is in-memory only (resets on restart); fine for a
  single-instance deployment.
- No customer record matching yet — the WhatsApp sender's name/phone and the
  original message are stored in the draft order's note field.
