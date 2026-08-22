"""Subprocess runner for the HojichaYa ops scripts.

The contract every tool returns is {ok, ran, data, reason}. The distinction that
matters, and the reason this module exists at all:

    ran=False  ->  the check did not happen. UNKNOWN. Never an all-clear.
    ran=True, ok=False  ->  the script ran but produced nothing usable.
    ran=True, ok=True   ->  data is real.

Three real incidents at HojichaYa came from a tool reporting nothing and being
read as "nothing wrong". Callers must be able to tell those apart, so a failure
here is always explicit and always carries a reason.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from facts_parser import parse_facts

DEFAULT_TIMEOUT_S = 120


@dataclass
class ToolResult:
    ok: bool
    ran: bool
    data: Any = None
    reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _fail(reason: str, ran: bool = False) -> ToolResult:
    return ToolResult(ok=False, ran=ran, data=None, reason=reason)


def tools_dir() -> Path:
    """Locate C:\\Claude\\tools without hardcoding it.

    PERMANENT_RULES -> Tools: never write a literal C:\\Claude\\... path in a tool
    script; import from tools/paths.py. We honour that by asking paths.py itself,
    and fall back to an env var so this is testable off the Windows box.
    """
    override = os.environ.get("HOJICHAYA_TOOLS_DIR")
    if override:
        return Path(override)
    raise RuntimeError(
        "HOJICHAYA_TOOLS_DIR is not set. Point it at the directory holding "
        "facts.py / velocity.py / paths.py (on Andri's PC: C:\\Claude\\tools)."
    )


def python_exe() -> str:
    """The interpreter to run the ops scripts with.

    CLAUDE.md environment trap: a bare `python` on this machine may hit the
    Microsoft Store stub, so the full path is configurable and preferred.
    """
    return os.environ.get("HOJICHAYA_PYTHON") or sys.executable


def run_script(script: str, args: list[str] | None = None,
               timeout_s: int = DEFAULT_TIMEOUT_S) -> ToolResult:
    """Run one ops script and normalise its result.

    Prefers structured output: if the script accepts --json we parse it. If it
    does not, the raw stdout is passed through under data.raw rather than being
    guessed at — inventing a parser for a format we have not seen is how a tool
    starts quietly reporting wrong numbers.
    """
    try:
        directory = tools_dir()
    except RuntimeError as exc:
        return _fail(str(exc))

    path = directory / script
    if not path.is_file():
        return _fail(f"{script} not found at {path}")

    cmd = [python_exe(), str(path), *(args or [])]

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout_s, cwd=str(directory)
        )
    except subprocess.TimeoutExpired:
        return _fail(f"{script} timed out after {timeout_s}s")
    except OSError as exc:
        return _fail(f"could not start {script}: {exc}")

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()[:800]
        return ToolResult(
            ok=False, ran=True, data=None,
            reason=f"{script} exited {proc.returncode}: {detail or 'no output'}",
        )

    stdout = (proc.stdout or "").strip()
    if not stdout:
        return ToolResult(
            ok=False, ran=True, data=None,
            reason=f"{script} ran but produced no output",
        )

    try:
        return ToolResult(ok=True, ran=True, data=json.loads(stdout))
    except json.JSONDecodeError:
        pass

    parsed = parse_facts(stdout)

    # facts.py prints its banner and exits 0 even when the argument names no
    # known section — `facts.py --json` did exactly that. Reporting it as a
    # successful empty result would let a typo read as "nothing wrong", which is
    # the failure this whole contract exists to prevent.
    if parsed["header_only"]:
        return ToolResult(
            ok=False, ran=True, data=None,
            reason=(
                f"{script} ran but printed no data section. The argument probably "
                f"names no known section. Do not read this as 'nothing to report'."
            ),
        )

    return ToolResult(ok=True, ran=True, data=parsed)
