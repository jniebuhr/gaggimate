"""Unit tests for check_firmware_size.py (no PlatformIO required)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from check_firmware_size import (
    MARKER,
    Sizes,
    fmt_bytes,
    fmt_delta,
    measure,
    parse_elf_size,
    render,
)


class FormatTests(unittest.TestCase):
    def test_bytes_and_delta(self) -> None:
        self.assertEqual(fmt_bytes(100), "100")
        self.assertEqual(fmt_bytes(2048), "2K")
        self.assertEqual(fmt_bytes(None), "—")
        self.assertEqual(fmt_delta(1100, 1000), "+100")
        self.assertEqual(fmt_delta(900, 1000), "-100")
        self.assertEqual(fmt_delta(1000, 1000), "0")
        self.assertEqual(fmt_delta(1000, None), "—")

    def test_elf_size(self) -> None:
        output = """   text    data     bss     dec     hex filename
 1000     200     300    1500     5dc firmware.elf
"""
        self.assertEqual(parse_elf_size(output), (1200, 500))


class MarkdownTests(unittest.TestCase):
    def test_table_delta(self) -> None:
        current = {
            "controller": Sizes(flash=1100, ram=80),
            "display": Sizes(flash=900, ram=70),
        }
        baseline = {
            "controller": Sizes(flash=1000, ram=80),
            "display": Sizes(flash=1000, ram=80),
        }
        text = render(current, baseline, "aaa111", "bbb222")
        self.assertIn(MARKER, text)
        self.assertIn("+100", text)
        self.assertIn("-100", text)
        self.assertIn("controller", text)


class MeasureTests(unittest.TestCase):
    def test_reads_firmware_bin(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("controller", "display", "display-headless"):
                build = root / ".pio" / "build" / name
                build.mkdir(parents=True)
                (build / "firmware.bin").write_bytes(b"\x00" * 50)
            reports = measure(root)
            self.assertEqual(reports["controller"].flash, 50)
            self.assertIsNone(reports["controller"].ram)


if __name__ == "__main__":
    unittest.main()
