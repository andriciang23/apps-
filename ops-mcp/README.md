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

If a script prints JSON, `data` is the parsed object. Otherwise the raw stdout is
passed through as `data.raw` — untouched, not guessed at. Inventing a parser for a
format we have not seen is how a tool starts quietly reporting wrong numbers.

**Upgrade worth making:** add a `--json` flag to `facts.py` and `velocity.py`. The
assistant can then read named fields (quantity, `as_of`, `days_cover`,
`one_order_from_zero`) instead of prose, which makes its answers more precise and
lets it cite time basis exactly.

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
