"""MCP server exposing the HojichaYa ops scripts as tools.

Wraps the existing scripts rather than reimplementing them. facts.py stays the
single source of truth for stock, cost, margin and reorder flags — this server
only carries their output across a process boundary, so there is no second
implementation to drift.

Runs over stdio, so it can be attached to the WhatsApp assistant, to Claude
Desktop, or to a Cowork session without change.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from runner import ToolResult, run_script

server = Server("hojichaya-ops")

_SKU_ARG = {
    "type": "object",
    "properties": {
        "sku": {
            "type": "string",
            "description": "Optional SKU or product name to filter to. Omit for all rows.",
        }
    },
    "additionalProperties": False,
}

_NO_ARGS = {"type": "object", "properties": {}, "additionalProperties": False}

TOOLS = [
    Tool(
        name="get_facts",
        description=(
            "Live stock, cost, margin and reorder flags from facts.py. The only "
            "permitted source for these figures. Returns {ok, ran, data, reason}; "
            "ran=false means the check did NOT happen and the answer is unknown."
        ),
        inputSchema=_SKU_ARG,
    ),
    Tool(
        name="get_velocity",
        description=(
            "Days of cover measured from real stock drawdown, via velocity.py, plus "
            "the ONE ORDER FROM ZERO flag. Use this for every cover claim — the "
            "ledger's own demand column is Shopify-only and overstates cover."
        ),
        inputSchema=_SKU_ARG,
    ),
    Tool(
        name="get_repack_plan",
        description=(
            "Current repack plan from repack_plan.py: which bulk packs to open to "
            "refill retail sizes. Repack before reorder; supplier ROP applies to bulk only."
        ),
        inputSchema=_NO_ARGS,
    ),
    Tool(
        name="get_rules_version",
        description=(
            "Version stamp of PERMANENT_RULES.md + DECISIONS.md via rules_version.py. "
            "Lets a long-running session notice its rules have gone stale."
        ),
        inputSchema=_NO_ARGS,
    ),
]

_SCRIPTS = {
    "get_facts": "facts.py",
    "get_velocity": "velocity.py",
    "get_repack_plan": "repack_plan.py",
    "get_rules_version": "rules_version.py",
}


@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any] | None) -> list[TextContent]:
    script = _SCRIPTS.get(name)
    if script is None:
        result = ToolResult(ok=False, ran=False, reason=f"unknown tool: {name}")
    else:
        args = []
        sku = (arguments or {}).get("sku")
        if sku:
            args.append(str(sku))
        result = await asyncio.to_thread(run_script, script, args)

    return [TextContent(type="text", text=json.dumps(result.to_dict()))]


async def main() -> None:
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
