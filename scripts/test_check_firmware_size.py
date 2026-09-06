"""Unit tests for check_firmware_size.py (no PlatformIO required)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from check_firmware_size import (
    COMMENT_MARKER,
    TargetReport,
    check_fit,
    find_app_slot,
    find_fs_slot,
    format_delta,
    parse_elf_size_output,
    parse_flash_size,
    parse_partition_number,
    parse_partitions_csv,
    partition_table_end,
    pio_env_boards,
    render_markdown,
    reports_from_json,
    reports_to_json,
)

SAMPLE_CSV = """# Name, Type, SubType, Offset, Size, Flags
nvs, data, nvs, 0x9000, 0x5000,
otadata, data, ota, 0xe000, 0x2000,
ota_0, app, ota_0, 0x10000, 1000,
ota_1, app, ota_1, 0x20000, 1000,
spiffs, data, spiffs, 0x30000, 400,
"""


class ParseTests(unittest.TestCase):
    def test_partition_numbers(self) -> None:
        self.assertEqual(parse_partition_number("0x330000"), 0x330000)
        self.assertEqual(parse_partition_number("1000"), 1000)
        self.assertEqual(parse_partition_number("64K"), 65536)
        self.assertEqual(parse_partition_number("3M"), 3 * 1024 * 1024)

    def test_flash_size(self) -> None:
        self.assertEqual(parse_flash_size("8MB"), 8 * 1024 * 1024)
        self.assertEqual(parse_flash_size("16MB"), 16 * 1024 * 1024)

    def test_csv_slots(self) -> None:
        parts = parse_partitions_csv(SAMPLE_CSV)
        app = find_app_slot(parts)
        fs = find_fs_slot(parts)
        self.assertEqual(app.size, 1000)
        self.assertEqual(fs.size, 400)
        self.assertEqual(partition_table_end(parts), 0x30000 + 400)

    def test_pio_extends(self) -> None:
        ini = """
[env:display]
board = LilyGo-T-RGB

[env:display-headless]
extends = env:display

[env:controller]
board = Gaggimate-Controller
"""
        boards = pio_env_boards(ini)
        self.assertEqual(boards["display"], "LilyGo-T-RGB")
        self.assertEqual(boards["display-headless"], "LilyGo-T-RGB")
        self.assertEqual(boards["controller"], "Gaggimate-Controller")

    def test_elf_size(self) -> None:
        output = """   text    data     bss     dec     hex filename
 1000     200     300    1500     5dc firmware.elf
"""
        flash, ram = parse_elf_size_output(output)
        self.assertEqual(flash, 1200)
        self.assertEqual(ram, 500)


class FitTests(unittest.TestCase):
    def test_exact_slot_ok(self) -> None:
        self.assertEqual(
            check_fit(
                used_flash=1000,
                flash_limit=1000,
                used_ram=100,
                ram_limit=327680,
                table_end=0x400000,
                flash_chip=0x400000,
                label="controller",
            ),
            [],
        )

    def test_firmware_one_byte_over(self) -> None:
        errors = check_fit(
            used_flash=1001,
            flash_limit=1000,
            used_ram=None,
            ram_limit=None,
            table_end=1000,
            flash_chip=4096,
            label="controller",
        )
        self.assertTrue(any("1001 bytes > slot 1000" in item for item in errors))

    def test_littlefs_over_spiffs(self) -> None:
        errors = check_fit(
            used_flash=401,
            flash_limit=400,
            used_ram=None,
            ram_limit=None,
            table_end=800,
            flash_chip=4096,
            label="display-filesystem",
        )
        self.assertTrue(any("401 bytes > slot 400" in item for item in errors))

    def test_table_over_flash(self) -> None:
        errors = check_fit(
            used_flash=10,
            flash_limit=100,
            used_ram=None,
            ram_limit=None,
            table_end=9 * 1024 * 1024,
            flash_chip=8 * 1024 * 1024,
            label="controller",
        )
        self.assertTrue(any("partition table end" in item for item in errors))


class MarkdownTests(unittest.TestCase):
    def test_delta_markers(self) -> None:
        self.assertEqual(format_delta(-240, 4096), "💚 -240")
        self.assertTrue(format_delta(1824, 4096).startswith("⚠️"))
        self.assertTrue(format_delta(5000, 4096).startswith("‼️"))
        self.assertEqual(format_delta(None, 4096), "—")

    def test_markdown_increase_and_decrease(self) -> None:
        current = {
            "controller": TargetReport(
                name="controller",
                flash=1100,
                flash_limit=2000,
                ram=80,
                ram_limit=320,
                fits=True,
            ),
            "display": TargetReport(
                name="display",
                flash=900,
                flash_limit=2000,
                ram=70,
                ram_limit=320,
                fits=True,
            ),
        }
        baseline = {
            "controller": TargetReport(
                name="controller",
                flash=1000,
                flash_limit=2000,
                ram=80,
                ram_limit=320,
                fits=True,
            ),
            "display": TargetReport(
                name="display",
                flash=1000,
                flash_limit=2000,
                ram=80,
                ram_limit=320,
                fits=True,
            ),
        }
        text = render_markdown(current, baseline, "aaa111", "bbb222")
        self.assertIn(COMMENT_MARKER, text)
        self.assertIn("controller", text)
        self.assertIn("⚠️ +100", text)
        self.assertIn("💚 -100", text)
        self.assertIn("✅", text)

    def test_json_roundtrip(self) -> None:
        reports = {
            "controller": TargetReport(
                name="controller",
                flash=1900,
                flash_limit=3342336,
                ram=82,
                ram_limit=327680,
            )
        }
        commit, loaded = reports_from_json(reports_to_json(reports, "deadbeef"))
        self.assertEqual(commit, "deadbeef")
        self.assertEqual(loaded["controller"].flash, 1900)
        self.assertEqual(loaded["controller"].ram, 82)


class IntegrationTests(unittest.TestCase):
    def test_collect_exact_and_overflow(self) -> None:
        from check_firmware_size import collect_reports

        csv = SAMPLE_CSV
        board = {
            "build": {"arduino": {"partitions": "partitions.csv"}},
            "upload": {"flash_size": "4MB", "maximum_ram_size": 327680},
        }
        ini = "[env:controller]\nboard = FakeBoard\n"

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "boards").mkdir()
            (root / "boards" / "FakeBoard.json").write_text(
                json.dumps(board), encoding="utf-8"
            )
            (root / "platformio.ini").write_text(ini, encoding="utf-8")
            (root / "partitions.csv").write_text(csv, encoding="utf-8")
            build = root / ".pio" / "build" / "controller"
            build.mkdir(parents=True)
            (build / "firmware.bin").write_bytes(b"\x00" * 1000)

            ok = collect_reports(root, ["controller"])
            self.assertTrue(ok["controller"].fits)
            self.assertEqual(ok["controller"].flash, 1000)
            self.assertEqual(ok["controller"].flash_limit, 1000)

            (build / "firmware.bin").write_bytes(b"\x00" * 1001)
            over = collect_reports(root, ["controller"])
            self.assertFalse(over["controller"].fits)


if __name__ == "__main__":
    unittest.main()
