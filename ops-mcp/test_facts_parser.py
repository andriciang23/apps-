"""Tests for the facts.py report parser.

Fixtures are real facts.py output from 22 Aug 2026, not invented. The two cases
that matter most are the ones that would otherwise fail silently: a header-only
report reading as "nothing wrong", and a truncated list reading as "not listed,
so fine".
"""

import unittest

from facts_parser import is_header_only, parse_facts

BANNER = """\
==============================================================================
HojichaYa CANONICAL FACTS - generated 2026-08-22 10:21
Computed from workbooks. Do NOT quote stock/cost/margin numbers from .md files.
RULES v16 - PERMANENT_RULES.md / DECISIONS.md last changed 2026-08-18.
  If this session read the rules BEFORE that date, re-read them before acting.
=============================================================================="""

FULL = (
    BANNER
    + """
STOCK (computed from ledger inputs - no Excel recalc needed)
  OVERSOLD (negative):
    Hojicha Teabags 20 Teabags                       -3.0  cover 0d
  OUT OF STOCK:
    Hojicha Powder "Kaori" 500g                         0
    ...and 16 more
  AT/BELOW REORDER POINT:
    Kimidori Matcha 500g                             17.0  ROP   32  cover 11d
  healthy SKUs: 41

MARGIN at REPLACEMENT cost (latest yen) - Cost & Margin History tab
  Kimidori Matcha 500g                      260     169    34.9

FRESHNESS CHECKS
  90d demand snapshot: 2026-06-29 (54 days old)  <-- STALE, refresh before trusting cover/ROP
  ledger last modified: 2026-08-22 01:47"""
)


class HeaderOnly(unittest.TestCase):
    def test_banner_alone_is_not_an_empty_success(self):
        # This is literally what `facts.py --json` produced. Treating it as a
        # successful empty result would let a mistyped argument read as
        # "nothing to report".
        self.assertTrue(is_header_only(BANNER))

    def test_a_real_report_is_not_header_only(self):
        self.assertFalse(is_header_only(FULL))

    def test_unrelated_text_is_not_header_only(self):
        self.assertFalse(is_header_only("some other script's output"))


class Parsing(unittest.TestCase):
    def setUp(self):
        self.result = parse_facts(FULL)

    def test_reads_provenance(self):
        self.assertEqual(self.result["rules_version"], "v16")
        self.assertEqual(self.result["rules_last_changed"], "2026-08-18")
        self.assertEqual(self.result["generated_at"], "2026-08-22 10:21")

    def test_splits_sections(self):
        self.assertIn("STOCK", self.result["sections"])
        self.assertIn("MARGIN", self.result["sections"])
        self.assertIn("FRESHNESS CHECKS", self.result["sections"])

    def test_reads_stock_rows_with_their_numbers(self):
        rop = self.result["stock"]["at_or_below_rop"]
        self.assertEqual(rop[0]["name"], "Kimidori Matcha 500g")
        self.assertEqual(rop[0]["quantity"], 17.0)
        self.assertEqual(rop[0]["reorder_point"], 32)
        self.assertEqual(rop[0]["cover_days"], 11)

    def test_keeps_negative_quantities_negative(self):
        oversold = self.result["stock"]["oversold"]
        self.assertEqual(oversold[0]["quantity"], -3.0)

    def test_flags_truncated_lists(self):
        # "...and 16 more" means 16 SKUs are absent from the output. Absent must
        # never be read as fine.
        self.assertEqual(self.result["truncated"], [{"group": "out_of_stock", "hidden_rows": 16}])
        self.assertTrue(any("cut short" in w for w in self.result["warnings"]))

    def test_promotes_staleness_to_a_warning(self):
        self.assertEqual(self.result["freshness"]["demand_snapshot_age_days"], 54)
        self.assertTrue(any("STALE" in w for w in self.result["warnings"]))

    def test_always_keeps_the_raw_text(self):
        # Structured fields are a convenience; nothing may be lost to a parse miss.
        self.assertEqual(self.result["raw"], FULL)

    def test_counts_healthy_skus(self):
        self.assertEqual(self.result["stock"]["healthy_count"], 41)


class Robustness(unittest.TestCase):
    def test_survives_an_unknown_section(self):
        text = BANNER + "\nSOMETHING NEW ENTIRELY\n  a: 1\n"
        result = parse_facts(text)
        # Unknown sections are kept verbatim rather than dropped.
        self.assertIn("SOMETHING NEW ENTIRELY", result["sections"])
        self.assertFalse(result["header_only"])

    def test_survives_empty_input(self):
        result = parse_facts("")
        self.assertEqual(result["raw"], "")
        self.assertFalse(result["header_only"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
