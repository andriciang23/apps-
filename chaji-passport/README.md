# Chaji Passport

One loyalty card and tea companion for **HojichaYa** (hojichaya.com) and **YAMA Café** (Sunway Square Mall).

- **`web/`: HojichaYa Passport.** A phone web app customers add to their home screen. It has a shared stamp card for both businesses, a tea journal, a tea finder, rewards, and a counter mode for YAMA staff. Build it with `node web/tools/build.mjs` (output in `web/dist/`). Refresh the tea list from a Shopify product export with `python3 web/tools/build_catalogue.py <export.json>`.
- **`app/`: Chaji server.** A Shopify app that stores cards and stamps, matches online orders to cards, issues reward codes, and runs the HoReCa reorder desk.

The original three surfaces:

1. **Café table passport.** Scan the QR at your YAMA table, see which HojichaYa tea your drink is made with, collect a stamp, and buy the tea to make at home.
2. **Roast & Umami Wheel.** An interactive tea finder on the storefront, driven by per-tea flavour profiles.
3. **HoReCa reorder desk.** Wholesale buyers set the stock levels they want to keep, enter what's on the shelf, and the app creates a draft order for the owner to approve.

The strategy and roadmap are in [docs/DESIGN.md](docs/DESIGN.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Data model (metaobjects), core logic, admin dashboard | **Done** |
| 2 | HojichaYa Passport phone app: shared card, journal, finder, rewards, counter mode (prototype, data on device) | **Prototype** |
| 2b | Server endpoints for the passport (join, stamp, redeem, order webhook) | Next |
| 3 | Tea finder on hojichaya.com (reuses the passport's finder) | Planned |
| 4 | HoReCa reorder desk (customer account extension) | Planned |
| 5 | Events scrapbook, milestone rewards, Flow emails | Planned |

## Layout

```
shopify.app.toml                  scopes, app proxy (/apps/chaji), metaobject definitions
prisma/schema.prisma              Stamp, WholesaleAccount, ParLevel (+ Shopify Session)
app/lib/flavour.ts                flavour space, matching, taste-from-history
app/lib/passport.ts               stamp rules, daily caps, milestones (MY timezone)
app/lib/table-code.ts             HMAC-signed table QR codes
app/lib/reorder.ts                par-level maths → draftOrderCreate input
app/data/proposed-tea-profiles.ts first-pass scores for the active teas (unverified)
app/models/tea-profiles.server.ts read profiles, owner-triggered import
app/routes/app._index.tsx         admin dashboard
```

## Store-safety rules

- **Nothing writes to the store until the owner acts.** Metaobject definitions are created when the owner runs `shopify app deploy`. Proposed profiles are created only when the owner presses **Import proposed profiles**, and they arrive with `verified = false`.
- Re-running the import never overwrites a profile that already exists.
- The reorder desk creates **draft** orders tagged `chaji-reorder`. It never completes or charges them.
- Customers only see teas that are verified, active and in stock.

## Develop

```sh
npm install
npm test            # unit tests (vitest)
npm run typecheck
npm run lint
shopify app config link   # once: connect to the HojichaYa app in the Partner/Dev dashboard
shopify app dev           # needs Shopify CLI + a dev store
```

Environment: copy `.env.example` → `.env`. `TABLE_CODE_SECRET` signs the café table QR codes, so keep it private and stable. Changing it invalidates every printed code.

Built on [Shopify's React Router app template](https://github.com/Shopify/shopify-app-template-react-router).
