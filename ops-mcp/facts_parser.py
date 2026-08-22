"""Turn facts.py's report into structured data.

facts.py prints a human report, not JSON. Parsing it here gives the assistant
named fields instead of prose, so it can state a figure's time basis exactly
rather than paraphrasing a paragraph.

Two things this must never lose, both of which cost real money if missed:

  * Truncation. The report abbreviates long lists as "...and 16 more". A SKU
    inside that remainder is absent from the output, and "absent" must never be
    read as "fine".
  * Staleness. The FRESHNESS CHECKS block currently says the 90-day demand
    snapshot is 54 days old and cover/ROP should not be trusted. Every cover
    figure downstream inherits that caveat.

The raw text is always returned alongside the parse. If a section is not
recognised, nothing is silently dropped.
"""

from __future__ import annotations

import re
from typing import Any

# The banner facts.py prints before any data. If this is all we got back, the
# script ran but matched no section — which is unknown, not all-clear.
_HEADER_MARKERS = ("HojichaYa CANONICAL FACTS", "Computed from workbooks")

# A section heading sits at column 0 and opens with a run of capitals. The rest
# of the line is a human description ("STOCK (computed from ledger inputs...)"),
# so only the leading capitals name the section.
_SECTION_RE = re.compile(r"^([A-Z][A-Z0-9]*(?: [A-Z0-9]+)*)")

_STOCK_GROUPS = {
    "OVERSOLD (negative):": "oversold",
    "OUT OF STOCK:": "out_of_stock",
    "AT/BELOW REORDER POINT:": "at_or_below_rop",
}

_TRUNCATION_RE = re.compile(r"\.\.\.\s*and\s+(\d+)\s+more", re.I)
_GENERATED_RE = re.compile(r"generated\s+([\d\-]+\s+[\d:]+)")
_RULES_RE = re.compile(r"RULES\s+(v\d+)\s*-.*?last changed\s+([\d\-]+)", re.S)


def is_header_only(text: str) -> bool:
    """True when facts.py printed its banner and no data.

    Happens when the argument names no known section — `facts.py --json` did
    exactly this. Treating it as a successful empty result would let a typo read
    as "nothing to report".
    """
    if not any(marker in text for marker in _HEADER_MARKERS):
        return False
    body = _strip_banner(text)
    return not body.strip()


def _strip_banner(text: str) -> str:
    """Everything after the banner's closing rule of = characters."""
    lines = text.splitlines()
    rules = [i for i, line in enumerate(lines) if set(line.strip()) == {"="} and len(line.strip()) > 10]
    return "\n".join(lines[rules[-1] + 1 :]) if rules else text


def parse_facts(text: str) -> dict[str, Any]:
    """Structured view of a facts.py report. Raw text always included."""
    result: dict[str, Any] = {
        "raw": text,
        "header_only": is_header_only(text),
        "truncated": [],
        "warnings": [],
    }

    if generated := _GENERATED_RE.search(text):
        result["generated_at"] = generated.group(1)
    if rules := _RULES_RE.search(text):
        result["rules_version"] = rules.group(1)
        result["rules_last_changed"] = rules.group(2)

    body = _strip_banner(text)
    sections = _split_sections(body)
    if "STOCK" in sections:
        result["stock"] = _parse_stock(sections["STOCK"], result)
    if freshness := sections.get("FRESHNESS CHECKS"):
        result["freshness"] = _parse_freshness(freshness, result)

    # Section text is kept verbatim for anything not specifically parsed, so a
    # section this parser does not know about still reaches the assistant.
    result["sections"] = sections
    return result


def _split_sections(body: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current: str | None = None
    buffer: list[str] = []

    for line in body.splitlines():
        stripped = line.strip()
        heading = (
            _SECTION_RE.match(stripped)
            if stripped and not line.startswith(" ") and not stripped.endswith(":")
            else None
        )
        # Require a few characters of capitals so a stray word is not a heading.
        if heading and len(heading.group(1)) >= 4:
            if current:
                sections[current] = "\n".join(buffer).strip()
            current = heading.group(1).strip()
            buffer = []
        elif current:
            buffer.append(line)

    if current:
        sections[current] = "\n".join(buffer).strip()
    return sections


def _parse_stock(text: str, result: dict[str, Any]) -> dict[str, Any]:
    stock: dict[str, Any] = {key: [] for key in _STOCK_GROUPS.values()}
    group: str | None = None

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        matched_group = next((v for k, v in _STOCK_GROUPS.items() if stripped == k), None)
        if matched_group:
            group = matched_group
            continue

        if more := _TRUNCATION_RE.search(stripped):
            # Record which list was cut short and how many rows are missing.
            result["truncated"].append({"group": group, "hidden_rows": int(more.group(1))})
            result["warnings"].append(
                f"The {group or 'stock'} list was cut short — {more.group(1)} rows are not shown. "
                f"Ask for a specific SKU rather than assuming it is absent."
            )
            continue

        if healthy := re.match(r"healthy SKUs:\s*(\d+)", stripped):
            stock["healthy_count"] = int(healthy.group(1))
            group = None
            continue

        if stripped.startswith("REMINDER") or stripped.startswith("Run tools"):
            continue

        if group and (row := _parse_stock_row(stripped)):
            stock[group].append(row)

    return stock


def _parse_stock_row(line: str) -> dict[str, Any] | None:
    """Split a stock line into name plus its trailing numeric fields."""
    row: dict[str, Any] = {}

    if cover := re.search(r"cover\s+(\d+)d", line):
        row["cover_days"] = int(cover.group(1))
        line = line[: cover.start()].rstrip()
    if rop := re.search(r"ROP\s+(\d+)", line):
        row["reorder_point"] = int(rop.group(1))
        line = line[: rop.start()].rstrip()
    if qty := re.search(r"(-?\d+(?:\.\d+)?)\s*$", line):
        row["quantity"] = float(qty.group(1))
        line = line[: qty.start()].rstrip()

    name = line.strip()
    if not name:
        return None
    row["name"] = name
    return row


def _parse_freshness(text: str, result: dict[str, Any]) -> dict[str, Any]:
    freshness: dict[str, Any] = {"notes": []}

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        freshness["notes"].append(stripped)

        # facts.py marks its own stale inputs with an arrow. Promote those to
        # warnings so the assistant states the caveat instead of burying it.
        if "<--" in stripped or "STALE" in stripped.upper():
            result["warnings"].append(stripped)

        if snapshot := re.search(r"90d demand snapshot:\s*([\d\-]+)\s*\((\d+) days old\)", stripped):
            freshness["demand_snapshot_date"] = snapshot.group(1)
            freshness["demand_snapshot_age_days"] = int(snapshot.group(2))

    return freshness
