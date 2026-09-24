# Chaji Passport: design and rationale

*Drafted 2026-09-24. Figures come from the live HojichaYa Shopify analytics for the 12 months to 2026-09-23 (sessions: last 90 days).*

## The data behind the design

| Signal | Value | Reading |
|---|---|---|
| Net sales | ~RM 697k | |
| Draft orders + Claude connector channel | RM 669k (96%), AOV ≈ RM 1,200–1,300 | Revenue is wholesale/HoReCa, keyed in by hand |
| Online Store channel | RM 21k (3%), 136 orders, AOV ≈ RM 156 | Retail web is barely a channel |
| Sessions (90d) | 5,504; 2.6% add to cart; 0.42% convert | Visitors don't know what to buy |
| Top product | Kimidori Matcha, RM 306k / 355 orders | Matcha is the revenue engine; hojicha is the brand |
| Returning customer rate | 55% | Once people buy, they stay |

**The problem:** wholesale is profitable but manual, and the café is where people taste the tea. Neither one sends people to the online store.

## Concept

One app with three surfaces, joined by a single **flavour profile** per customer.

### A. Café table passport (YAMA Café)
- Each table's QR code opens `hojichaya.com/apps/chaji/t/<signed-table-code>`.
- The customer picks the drink they have. The page shows "Made with Hojicha Powder Kaori", a home recipe, and one-tap add to cart (sampler or full size).
- Saving a stamp needs a Shopify customer account login (email one-time code). Limits: each drink once per day, at most 3 café stamps per day. Table codes are HMAC-signed so they can't be guessed.
- Milestones count distinct teas: First cup (1), Explorer (3), Roaster (6), Chajin (10). The owner decides what each one unlocks.

### B. Roast & Umami Wheel (storefront)
- A theme app block with two dials: roast (Kyo → Aka → Kaori) and umami (Kimidori → Takamidori → Kitsune).
- It matches against the `tea_profile` metaobjects. Only teas that are verified, active and in stock appear.
- Returning passport holders start from their own taste, and teas they've already tried are hidden from "next to try".

### C. HoReCa reorder desk (customer account)
- Buyers tagged `horeca` set the stock level they want to keep for each product, enter what's on the shelf, and get a suggested order rounded up to whole packs.
- Submitting creates a **draft order** tagged `chaji-reorder` for the owner to approve. This matches today's draft-order workflow. The store is on the Basic plan, so native B2B (Plus) isn't available, and this doesn't need it.

### Events scrapbook
- `tea_event` metaobjects hold photos, video, the teas tasted and an attendee stamp code. Each event page ends in a shopping list of the teas tasted.

## Why this and not…

- **A 3D café render:** too heavy for about 1,800 mostly-mobile sessions a month, and it doesn't fix the real leak, which is choosing a tea. A 2.5D illustrated map can come later if passport data shows people use location features.
- **Generic points loyalty:** rewards spend that would happen anyway. The passport rewards trying new teas, which is what grows basket size.
- **A booking widget:** ends at the booking. Workshops matter because attendees become buyers.
- **Why build the reorder desk now:** 96% of revenue arrives as hand-keyed draft orders. Self-serve reorder saves owner time immediately and produces the first structured data on what buyers use.

## Data model

| Object | Where | Purpose |
|---|---|---|
| `$app:tea_profile` | Metaobject (TOML) | roast/umami/sweetness/astringency 0–10, caffeine, brew guide, `verified` |
| `$app:cafe_drink` | Metaobject (TOML) | menu drink → product it's made with, starter product, home recipe |
| `$app:tea_event` | Metaobject (TOML) | photos, video, teas tasted, stamp code |
| `product.metafields.app.tea_profile` | Metafield (TOML) | theme blocks read a product's profile directly |
| `Stamp` | App DB | passport history (unique per customer/kind/ref/day) |
| `WholesaleAccount`, `ParLevel` | App DB | reorder desk |

## Roadmap

1. **Foundation. Done.** App scaffold, scopes, app proxy, metaobject definitions, Prisma models, flavour/passport/table-code/reorder logic with tests, admin dashboard with owner-triggered profile import.
2. **Café passport.** Proxy routes for table scan, drink pick and stamp. Theme block for drink cards. QR sheet generator in admin. Pilot on 10 tables and measure scans → sampler orders.
3. **Wheel.** Theme app block (plain JS + SVG, no framework), deep links from passport results, A/B test against the existing tea-finder page.
4. **Reorder desk.** Customer account UI extension, par-level editor in admin, draft order creation, owner notification.
5. **Scrapbook and rewards.** Event pages, milestone discounts via a discount Function, Shopify Flow nudges ("your usual Kaori is due").

## Owner inputs needed

- Review and verify the 17 proposed tea profiles (admin → Content → Metaobjects).
- The YAMA Café drink list and which product each drink uses. I don't have the menu, so none is invented here.
- Event photos and videos to upload to Files.
- What each passport milestone unlocks, if anything.
- Link the app: `shopify app config link`, then `shopify app deploy` when ready.
