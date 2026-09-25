#!/usr/bin/env python3
"""Print FLASH/RAM for shipping images and the delta vs master."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from shutil import which

MARKER = "<!-- gaggimate-firmware-size -->"
TARGETS = ("controller", "display", "display-headless")


@dataclass(frozen=True)
class Sizes:
    flash: int
    ram: int | None = None


def find_size_tool() -> str | None:
    """Find xtensa-esp32s3-elf-size on PATH or in PlatformIO packages."""
    found = which("xtensa-esp32s3-elf-size")
    if found:
        return found
    packages = Path.home() / ".platformio" / "packages"
    matches = sorted(
        packages.glob("toolchain-xtensa-esp32s3*/bin/xtensa-esp32s3-elf-size")
    )
    return str(matches[0]) if matches else None


def parse_elf_size(text: str) -> tuple[int, int] | None:
    """Parse GNU size -B output into (flash, ram)."""
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 3 or parts[0] == "text":
            continue
        try:
            text_size = int(parts[0])
            data_size = int(parts[1])
            bss_size = int(parts[2])
        except ValueError:
            continue
        return text_size + data_size, data_size + bss_size
    return None


def ram_from_elf(elf: Path) -> int | None:
    """Return static RAM (data + bss), or None if the size tool is missing."""
    tool = find_size_tool()
    if tool is None or not elf.is_file():
        return None
    result = subprocess.run(
        [tool, "-B", str(elf)],
        check=True,
        capture_output=True,
        text=True,
    )
    parsed = parse_elf_size(result.stdout)
    return None if parsed is None else parsed[1]


def measure(root: Path) -> dict[str, Sizes]:
    """Read firmware.bin size and ELF RAM for each shipping env."""
    reports: dict[str, Sizes] = {}
    for name in TARGETS:
        build = root / ".pio" / "build" / name
        firmware = build / "firmware.bin"
        if not firmware.is_file():
            raise SystemExit(f"missing {firmware}")
        reports[name] = Sizes(
            flash=firmware.stat().st_size,
            ram=ram_from_elf(build / "firmware.elf"),
        )
    return reports


def fmt_bytes(value: int | None) -> str:
    """Format a byte count."""
    if value is None:
        return "—"
    if abs(value) >= 1024:
        if value % 1024 == 0:
            return f"{value // 1024}K"
        return f"{value / 1024:.1f}K"
    return str(value)


def fmt_delta(current: int | None, previous: int | None) -> str:
    """Format current - previous."""
    if current is None or previous is None:
        return "—"
    delta = current - previous
    if delta == 0:
        return "0"
    sign = "-" if delta < 0 else "+"
    return f"{sign}{fmt_bytes(abs(delta))}"


def render(
    current: dict[str, Sizes],
    baseline: dict[str, Sizes],
    commit: str,
    baseline_commit: str | None,
) -> str:
    """Render the PR comment table."""
    lines = [MARKER, "## Memory usage (PR vs master)", ""]
    short = commit[:12]
    if baseline and baseline_commit:
        lines.append(
            f"Compared against master `{baseline_commit[:12]}`. Current `{short}`."
        )
    elif baseline:
        lines.append(f"Compared against the last master baseline. Current `{short}`.")
    else:
        lines.append(f"No master baseline yet. Current `{short}`.")
    lines += [
        "",
        "| Target | FLASH | Δ FLASH | RAM | Δ RAM |",
        "| --- | --- | --- | --- | --- |",
    ]
    for name, cur in current.items():
        prev = baseline.get(name)
        dflash = fmt_delta(cur.flash, prev.flash if prev else None)
        dram = fmt_delta(cur.ram, prev.ram if prev else None)
        lines.append(
            f"| {name} | {fmt_bytes(cur.flash)} | {dflash} | {fmt_bytes(cur.ram)} | {dram} |"
        )
    return "\n".join(lines) + "\n"


def reports_to_json(reports: dict[str, Sizes], commit: str) -> dict[str, object]:
    """Serialize the report we just measured."""
    payload: dict[str, object] = {"commit": commit}
    for name, sizes in reports.items():
        payload[f"{name}.flash"] = sizes.flash
        payload[f"{name}.ram"] = sizes.ram
    return payload


def load_baseline(path: str) -> tuple[str | None, dict[str, Sizes]]:
    """Load baseline/sizes.json if it exists."""
    if not os.path.isfile(path):
        return None, {}
    with open(path, encoding="utf-8") as handle:
        # json.load is untyped; this file is only written by reports_to_json.
        data: dict[str, object] = json.load(handle)  # type: ignore[assignment]
    commit = data.get("commit")
    reports: dict[str, Sizes] = {}
    for name in TARGETS:
        flash = data.get(f"{name}.flash")
        ram = data.get(f"{name}.ram")
        if isinstance(flash, bool) or not isinstance(flash, int):
            continue
        if ram is not None and (isinstance(ram, bool) or not isinstance(ram, int)):
            ram = None
        reports[name] = Sizes(flash=flash, ram=ram)
    return (commit if isinstance(commit, str) else None), reports


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--markdown", action="store_true")
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--commit", default="")
    args = parser.parse_args(argv)

    reports = measure(Path.cwd())
    commit = args.commit or os.environ.get("GITHUB_SHA") or "unknown"
    baseline_commit: str | None = None
    baseline: dict[str, Sizes] = {}
    if args.baseline:
        baseline_commit, baseline = load_baseline("baseline/sizes.json")
    markdown = render(reports, baseline, commit, baseline_commit)
    print(markdown)
    os.makedirs("out", exist_ok=True)
    if args.markdown:
        with open("out/sizes.md", "w", encoding="utf-8") as handle:
            handle.write(markdown)
    if args.json:
        with open("out/sizes.json", "w", encoding="utf-8") as handle:
            json.dump(reports_to_json(reports, commit), handle, indent=2)
            handle.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
