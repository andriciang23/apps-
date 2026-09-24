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

## Update 2026-09-24 — phone app first, one card for both businesses

The owner asked for the customer experience to live outside Shopify (web or phone) and for YAMA Café and HojichaYa to be joined by one loyalty card. The build now has two parts:

| Part | What it is | Where |
|---|---|---|
| **HojichaYa Passport** | Installable phone web app (PWA). Card, tea journal, tea finder, rewards, YAMA counter mode | `web/` — static files, host anywhere (e.g. `passport.hojichaya.com`) |
| **Chaji server** | This Shopify app. Holds cards and stamps, matches online orders to cards, issues reward codes, runs the HoReCa reorder desk | `app/` |

Shopify stays the shop. The passport is the relationship.

### How the two businesses connect

- **One identity: the mobile number.** Customers join with their Malaysian mobile, which is how they check out online and how YAMA staff already talk to them on WhatsApp. `normaliseMyMobile()` makes `012-345 6789`, `+60 12 345 6789` and `60123456789` the same person.
- **One card, two kinds of stamp.** 山 (yama, mountain) seals are stamped by YAMA staff at the counter. 茶 (cha, tea) seals come from hojichaya.com orders, added automatically when an `orders/paid` webhook's phone or email matches a card. Both fill the same 8-slot card.
- **The tea travels with the stamp.** The barista taps which tea the drink was made with. That one tap fills the customer's tea journal and powers "Your drink at YAMA was made with Hojicha Powder Kaori → take it home". The café menu never has to be mapped by hand, and no claim is made that staff didn't enter.
- **Spend it at either door.** A full card becomes a reward the customer chooses when it's ready: at the YAMA counter (staff redeem in counter mode) or a single-use discount code for hojichaya.com.
- **Tea journal as the long game.** Distinct teas tried, from either door, unlock recognition titles (First cup, Explorer, Roaster, Chajin 茶人). These are titles only; no perks promised.
- **Card number is random**, never derived from the phone number, because it is shown on screen and in the QR.

### Intent map — what the person wants at each moment, and how the app answers

| Moment | Their intent | Design response |
|---|---|---|
| At a YAMA table, first time | "Is this worth my time?" | Demo card opens in a working state; joining is one field (mobile) and one button. No password, no email. |
| At the counter, paying | "Quick, there's a queue" | Card tab has one primary button: *Show my card at the counter*. Full-screen QR, screen kept awake, number shown for read-out. |
| Barista, busy | "Stamp and move on" | Counter mode: card number, one tap for the tea, *Add stamp*. Confirmation appears at the top where they're looking. |
| After a café visit | "I liked that. What was it?" | The card leads with *From your last cup*: the exact tea, its notes, price and a direct link to that product. |
| After an online order | "Did it count?" | Stamp appears on the same card; the card then invites them to the café for the next one. |
| Browsing at home | "What should I buy?" | *Find a tea*: drag toward roasted or green, rich or light. Quick picks match real reasons (evenings, lattes, something new). Three ranked matches, each one tap from buying. |
| Returning | "How close am I?" | Progress sentence under the card: *3 more stamps to your next reward*. Rewards tab dot when one is ready. |
| Reward ready | "Where can I use it?" | Two clear choices, café or online, decided at the moment of spending, not at sign-up. |

### Copy principles applied

- HojichaYa voice: calm, warm, we/you, British-Malaysian spelling (flavour), `RM 45.00` format, no emoji.
- Japanese terms as quiet accents with meaning nearby: 通い帳 (a regular's passbook) on the card, 茶帳 on the journal, family names in kana/kanji on filters.
- Every button says what happens: *Show my card at the counter*, *Add stamp*, *Take it home · RM 45.00*, *Get my code*.
- Honesty: sold-out teas say so instead of offering a larger size; flavour scores are labelled a first draft; reward values and the prototype's local storage are labelled as placeholders.

### Still needed for launch

1. Owner decisions: stamps per card (8 proposed), the YAMA reward, the online reward value, whether a stamp needs a minimum spend.
2. Server endpoints: `POST /api/join` (WhatsApp/SMS one-time code), `GET /api/card`, `POST /api/stamp` (staff PIN), `POST /api/redeem`, `orders/paid` webhook → stamp, reward codes via `discountCodeBasicCreate`.
3. Counter mode on a café tablet with camera scanning (`BarcodeDetector`).
4. Hosting for `web/` and the PDPA consent wording for storing mobile numbers.

## Update 2026-09-24 (later) — YAMA visual identity

The owner preferred YAMA's look to the HojichaYa web palette, so the passport now follows the café. Sources, from the owner's Google Drive: the wall mural artwork, the eight process illustrations it's built from (`YAMA Wall Design`), the wall font files, the tea-field reference photo, and the pre-opening shopfront photos. The finished shop photos (`YAMA Shop Photos`, 10–23 MB each) were over the Drive connector's download limit and weren't reviewed.

| Element | From | Used as |
|---|---|---|
| `#DCDEA0` pistachio | Mural background | Page ground |
| `#F0F0C0` cream strokes | Mural doodle lines | Tiled hand-drawn background |
| `#FFFFFA` | Mural circles, plaster wall | Cards, stamp discs, tea cups |
| `#304810` olive | Illustration linework | Text, primary buttons |
| `#60A040` leaf | Illustration leaf fill | Online (茶) stamps, highlights |
| `#8C5838` brown | Mural path | YAMA (山) stamps, progress, reward CTA |
| Layered ridges with warm glow | Shopfront plaster relief with backlight | Card header |
| Walnut | Shopfront shelving | Staff counter mode background |
| Kozuka Gothic Pr6N (licensed) | Wall font folder | Noto Sans JP, its open-source counterpart by the same designer |

**The card is the mural.** Eight stamps, eight steps, in the mural's order: Harvest 摘採, Steam 蒸熱, Roll 粗揉, Twist 揉捻, Shape 精揉, Dry 乾燥, Sort 選別, Roast 焙煎. The brown path winds through the steps; each stamp fills the next illustration and carries a 山 or 茶 badge for where it was earned. The eighth stamp roasts the leaf and unlocks the reward. Customers who stand in front of the wall see the same journey on their phone.

Illustrations live in `web/art/` (280px, 10–18 KB each). **Owner to confirm** the illustrator's licence covers use in the app.

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
