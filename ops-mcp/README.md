# ops-mcp — HojichaYa ops tools over MCP

Wraps the existing scripts in `C:\Claude\tools\` as MCP tools. It does **not**
reimplement them: `facts.py` stays the single source of truth for stock, cost,
margin and reorder flags, so there is no second implementation to drift.

## Tools

| Tool | Script | Use for |
|---|---|---|
| `get_facts` | `facts.py` | Stock, cost, margin, reorder flags |
| `get_velocity` | `velocity.py` | Days of cover, ONE ORDER FROM ZERO flag |
| `get_repack_plan` | `repack_plan.py` | Which bulk packs to open |
| `get_rules_version` | `rules_version.py` | Rules staleness stamp |

## The result contract

Every tool returns `{ok, ran, data, reason}`.

| | Meaning |
|---|---|
| `ran: false` | The check **did not happen**. Unknown. Never an all-clear. |
| `ran: true, ok: false` | Script ran, produced nothing usable. `reason` says why. |
| `ran: true, ok: true` | `data` is real. |

This shape exists because three real incidents came from a tool reporting nothing
and being read as "nothing wrong". Callers must always be able to tell those apart.

## Output parsing

`facts.py` prints a human report, not JSON, so `facts_parser.py` reads it into
named fields: stock groups with quantities, reorder points and cover; the margin
table; freshness; and the rules version. The raw text is always kept in
`data.raw`, so a parse miss loses nothing.

Two flags exist because getting them wrong costs money:

- **`data.truncated`** — the report abbreviates long lists as `...and 16 more`.
  Those SKUs are absent from the output, and absent must never read as fine. The
  parser records which list was cut and how many rows are hidden.
- **`data.warnings`** — promoted from the report's own caveats. As of 22 Aug 2026
  it carries *"90d demand snapshot: 2026-06-29 (54 days old) — STALE, refresh
  before trusting cover/ROP"*, so every cover figure inherits that caveat. The
  assistant is instructed to repeat these when quoting an affected number.

### `facts.py` takes a section, not a SKU

`facts.py wholesale` selects a section. An unrecognised argument makes it print
its banner and exit 0 — `facts.py --json` did exactly that. The runner detects a
header-only report and returns `ok: false` with a reason, because a successful
empty result is indistinguishable from "nothing is wrong".

`velocity.py`'s arguments are **not yet verified** — the tool passes an optional
`sku` on the assumption it filters that way. Confirm before relying on it.

## Tests

`python3 -m unittest test_facts_parser -v` — 13 tests against real 22 Aug 2026
output, covering the header-only case and truncation detection.

## Setup (on Andri's PC)

```
pip install -r requirements.txt
set HOJICHAYA_TOOLS_DIR=C:\Claude\tools
set HOJICHAYA_PYTHON=C:\Users\firec\AppData\Local\Programs\Python\Python312\python.exe
python server.py
```

`HOJICHAYA_PYTHON` matters: a bare `python` on this machine can hit the Microsoft
Store stub. No `C:\Claude\...` path is hardcoded anywhere in this package.

## Verify before trusting it

1. Run each tool and diff its `data` against running the same script in a terminal.
   They must match cell for cell.
2. Rename `facts.py` temporarily and confirm you get `ran: false` with a reason —
   not an empty success.
3. `compute.py --verify` still passes (ledger formula fingerprint intact).
