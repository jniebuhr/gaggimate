#!/usr/bin/env python3
"""Check GaggiMate firmware/LittleFS against partition slots and report size deltas."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from shutil import which
from typing import TypeGuard

COMMENT_MARKER = "<!-- gaggimate-firmware-size -->"
FLASH_ALERT_BYTES = 4096
RAM_ALERT_BYTES = 64
JSON_REPORT = Path("out") / "sizes.json"
MARKDOWN_REPORT = Path("out") / "sizes.md"
BASELINE_REPORT = Path("baseline") / "sizes.json"

APP_SUBTYPES = frozenset({"ota_0", "app0"})
FS_SUBTYPES = frozenset({"spiffs", "fat", "littlefs"})


@dataclass(frozen=True)
class Partition:
    name: str
    type: str
    subtype: str
    offset: int
    size: int


@dataclass
class TargetReport:
    name: str
    flash: int
    flash_limit: int
    ram: int | None = None
    ram_limit: int | None = None
    fits: bool = True
    errors: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class TargetSpec:
    name: str
    env: str
    kind: str  # "app" or "fs"


@dataclass(frozen=True)
class BoardConfig:
    partitions: str
    flash_size: str
    maximum_ram_size: int


DEFAULT_TARGETS = (
    TargetSpec("controller", "controller", "app"),
    TargetSpec("display", "display", "app"),
    TargetSpec("display-headless", "display-headless", "app"),
    TargetSpec("display-filesystem", "display", "fs"),
)


def parse_partition_number(value: str) -> int:
    """Parse ESP-IDF partition numbers, including hex and K/M suffixes."""
    raw = value.strip()
    if not raw:
        raise ValueError("empty partition number")
    multiplier = 1
    if raw[-1:].lower() == "k":
        multiplier = 1024
        raw = raw[:-1]
    elif raw[-1:].lower() == "m":
        multiplier = 1024 * 1024
        raw = raw[:-1]
    return int(raw, 0) * multiplier


def parse_flash_size(value: str) -> int:
    """Parse board flash size values such as 8MB."""
    raw = value.strip().upper()
    match = re.fullmatch(r"(\d+)\s*MB", raw)
    if match:
        return int(match.group(1)) * 1024 * 1024
    return parse_partition_number(value)


def parse_partitions_csv(text: str) -> list[Partition]:
    """Parse an ESP-IDF partitions CSV from text."""
    partitions: list[Partition] = []
    for row in csv.reader(text.splitlines()):
        if not row or row[0].lstrip().startswith("#") or len(row) < 5:
            continue
        name, part_type, subtype, offset, size = (field.strip() for field in row[:5])
        if not name:
            continue
        partitions.append(
            Partition(
                name=name,
                type=part_type,
                subtype=subtype,
                offset=parse_partition_number(offset),
                size=parse_partition_number(size),
            )
        )
    return partitions


def find_app_slot(partitions: list[Partition]) -> Partition:
    """Return the primary app slot (ota_0 / app0)."""
    for part in partitions:
        if part.type == "app" and part.subtype in APP_SUBTYPES:
            return part
    for part in partitions:
        if part.type == "app":
            return part
    raise ValueError("no app partition found")


def find_fs_slot(partitions: list[Partition]) -> Partition:
    """Return the filesystem partition used for LittleFS."""
    for part in partitions:
        if part.type == "data" and part.subtype in FS_SUBTYPES:
            return part
    raise ValueError("no filesystem partition found")


def partition_table_end(partitions: list[Partition]) -> int:
    """Return the first byte past the last partition."""
    if not partitions:
        raise ValueError("empty partition table")
    return max(part.offset + part.size for part in partitions)


def resolve_inside(base: Path, raw: Path) -> Path:
    """Resolve raw and reject paths that escape base."""
    base_resolved = base.resolve()
    candidate = raw.expanduser()
    resolved = (
        candidate.resolve()
        if candidate.is_absolute()
        else (base_resolved / candidate).resolve()
    )
    if not resolved.is_relative_to(base_resolved):
        message = f"path escapes {base_resolved}: {raw}"
        raise ValueError(message)
    return resolved


def pio_env_boards(ini_text: str) -> dict[str, str]:
    """Map PlatformIO env names to board names, following extends=."""
    boards: dict[str, str] = {}
    extends: dict[str, str] = {}
    current: str | None = None
    for raw_line in ini_text.splitlines():
        line = raw_line.split(";", 1)[0].strip()
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            current = section[4:] if section.startswith("env:") else None
            continue
        if current is None or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if key == "board":
            boards[current] = value
        elif key == "extends":
            extends[current] = value.removeprefix("env:")
    pending = dict(extends)
    while pending:
        progress = False
        for env, parent in list(pending.items()):
            if env in boards:
                del pending[env]
                progress = True
                continue
            if parent in boards:
                boards[env] = boards[parent]
                del pending[env]
                progress = True
        if not progress:
            break
    return boards


def find_partition_csv(
    name: str, root: Path, extra_roots: list[Path] | None = None
) -> Path:
    """Locate a partition CSV by file name."""
    candidates = [root / name, root / "partitions" / name]
    for extra in extra_roots or []:
        candidates.append(extra / name)
        candidates.append(extra / "tools" / "partitions" / name)
    for path in candidates:
        if path.is_file():
            return path
    packages = Path.home() / ".platformio" / "packages"
    if packages.is_dir():
        matches = sorted(packages.glob(f"**/tools/partitions/{name}"))
        if matches:
            return matches[0]
    raise FileNotFoundError(f"partition table not found: {name}")


def find_size_tool() -> Path | None:
    """Find xtensa-esp32s3-elf-size in PATH or PlatformIO packages."""
    found = which("xtensa-esp32s3-elf-size")
    if found:
        return Path(found)
    packages = Path.home() / ".platformio" / "packages"
    if packages.is_dir():
        matches = sorted(
            packages.glob("toolchain-xtensa-esp32s3*/bin/xtensa-esp32s3-elf-size")
        )
        if matches:
            return matches[0]
    return None


def parse_elf_size_output(text: str) -> tuple[int, int]:
    """Parse GNU size (Berkeley) output into (flash, ram)."""
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
    raise ValueError(f"unrecognized size output:\n{text}")


def measure_elf(elf: Path, size_tool: Path | None = None) -> tuple[int, int] | None:
    """Return (flash, ram) from an ELF, or None if the size tool is missing."""
    tool = size_tool or find_size_tool()
    if tool is None or not elf.is_file():
        return None
    result = subprocess.run(
        [str(tool), "-B", str(elf)],
        check=True,
        capture_output=True,
        text=True,
    )
    return parse_elf_size_output(result.stdout)


def check_fit(
    *,
    used_flash: int,
    flash_limit: int,
    used_ram: int | None,
    ram_limit: int | None,
    table_end: int,
    flash_chip: int,
    label: str,
) -> list[str]:
    """Return overflow errors; empty means the image fits."""
    errors: list[str] = []
    if used_flash > flash_limit:
        errors.append(f"{label}: {used_flash} bytes > slot {flash_limit}")
    if used_ram is not None and ram_limit is not None and used_ram > ram_limit:
        errors.append(f"{label}: RAM {used_ram} bytes > {ram_limit}")
    if table_end > flash_chip:
        errors.append(f"{label}: partition table end {table_end} > flash {flash_chip}")
    return errors


def format_bytes(value: int) -> str:
    """Format a byte count for tables."""
    if abs(value) >= 1024:
        if value % 1024 == 0:
            return f"{value // 1024}K"
        return f"{value / 1024:.1f}K"
    return str(value)


def format_delta(delta: int | None, alert_bytes: int) -> str:
    """Format a signed delta with Arduino-style markers."""
    if delta is None:
        return "—"
    if delta == 0:
        return "0"
    pretty = format_bytes(abs(delta))
    signed = f"-{pretty}" if delta < 0 else f"+{pretty}"
    if delta < 0:
        return f"💚 {signed}"
    if abs(delta) >= alert_bytes:
        return f"‼️ {signed}"
    return f"⚠️ {signed}"


def format_pct(delta: int | None, baseline: int | None) -> str:
    """Format a delta as a percentage of the baseline value."""
    if delta is None or not baseline:
        return "—"
    if delta == 0:
        return "0.00"
    pct = (delta / baseline) * 100
    pretty = f"{pct:+.2f}"
    if delta < 0:
        return f"💚 {pretty}"
    if abs(delta) >= FLASH_ALERT_BYTES and baseline:
        return f"‼️ {pretty}"
    return f"⚠️ {pretty}"


def occupancy(used: int, limit: int) -> str:
    """Format used/limit and percent."""
    pct = (used / limit) * 100 if limit else 0
    return f"{format_bytes(used)} / {format_bytes(limit)} ({pct:.1f}%)"


def render_markdown(
    current: dict[str, TargetReport],
    baseline: dict[str, TargetReport] | None,
    commit: str,
    baseline_commit: str | None,
) -> str:
    """Render the PR comment body."""
    lines = [
        COMMENT_MARKER,
        "## Memory usage (PR vs master)",
        "",
    ]
    if baseline and baseline_commit:
        lines.append(
            f"Compared against master `{baseline_commit[:12]}`. Current `{commit[:12]}`."
        )
    elif baseline:
        lines.append(
            f"Compared against the last master baseline. Current `{commit[:12]}`."
        )
    else:
        lines.append(
            f"No master baseline yet — fit check only. Current `{commit[:12]}`."
        )
    lines.extend(
        [
            "",
            "| Target | FLASH | Slot used | Fit | Δ FLASH | Δ FLASH [%] | RAM | Δ RAM |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for name, report in current.items():
        prev = baseline.get(name) if baseline else None
        flash_delta = report.flash - prev.flash if prev else None
        ram_delta = None
        if prev and report.ram is not None and prev.ram is not None:
            ram_delta = report.ram - prev.ram
        ram_cell = "—"
        if report.ram is not None and report.ram_limit:
            ram_cell = occupancy(report.ram, report.ram_limit)
        elif report.ram is not None:
            ram_cell = format_bytes(report.ram)
        fit = "✅" if report.fits else "❌ overflow"
        lines.append(
            "| {name} | {flash} | {slot} | {fit} | {dflash} | {dpct} | {ram} | {dram} |".format(
                name=name,
                flash=occupancy(report.flash, report.flash_limit),
                slot=f"{report.flash_limit} B",
                fit=fit,
                dflash=format_delta(flash_delta, FLASH_ALERT_BYTES),
                dpct=format_pct(flash_delta, prev.flash if prev else None),
                ram=ram_cell,
                dram=format_delta(ram_delta, RAM_ALERT_BYTES),
            )
        )
    lines.extend(
        [
            "",
            "The job fails only when firmware, LittleFS, or RAM does not fit the board slot.",
            "Deltas are informational.",
        ]
    )
    return "\n".join(lines) + "\n"


def reports_to_json(reports: dict[str, TargetReport], commit: str) -> dict[str, object]:
    """Serialize reports for the baseline artifact."""
    return {
        "commit": commit,
        "targets": {
            name: {
                "flash": report.flash,
                "flash_limit": report.flash_limit,
                "ram": report.ram,
                "ram_limit": report.ram_limit,
                "fits": report.fits,
            }
            for name, report in reports.items()
        },
    }


def is_json_object(value: object) -> TypeGuard[dict[str, object]]:
    """True when value is a JSON object. json.loads always uses str keys."""
    return isinstance(value, dict)


def as_object(value: object, label: str) -> dict[str, object]:
    """Require a JSON object."""
    if not is_json_object(value):
        raise TypeError(f"{label} must be an object")
    return value


def json_int(value: object, label: str) -> int:
    """Require a JSON integer (bool is rejected)."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{label} must be an integer")
    return value


def optional_json_int(value: object, label: str) -> int | None:
    """Require a JSON integer or null."""
    if value is None:
        return None
    return json_int(value, label)


def reports_from_json(
    payload: dict[str, object],
) -> tuple[str, dict[str, TargetReport]]:
    """Load reports from a baseline artifact."""
    commit = str(payload.get("commit") or "")
    targets_raw = as_object(payload.get("targets"), "baseline targets")
    reports: dict[str, TargetReport] = {}
    for name, raw in targets_raw.items():
        target = as_object(raw, f"target {name}")
        reports[name] = TargetReport(
            name=name,
            flash=json_int(target.get("flash"), f"{name}.flash"),
            flash_limit=json_int(target.get("flash_limit"), f"{name}.flash_limit"),
            ram=optional_json_int(target.get("ram"), f"{name}.ram"),
            ram_limit=optional_json_int(target.get("ram_limit"), f"{name}.ram_limit"),
            fits=bool(target.get("fits", True)),
        )
    return commit, reports


def load_board(root: Path, board_name: str) -> BoardConfig:
    """Load the partition and size fields from a PlatformIO board JSON."""
    path = root / "boards" / f"{board_name}.json"
    if not path.is_file():
        raise FileNotFoundError(f"board definition not found: {path}")
    data = as_object(json.loads(path.read_text(encoding="utf-8")), path.name)
    upload = as_object(data.get("upload"), f"{board_name} upload")
    build = as_object(data.get("build"), f"{board_name} build")
    arduino = as_object(build.get("arduino"), f"{board_name} build.arduino")
    partitions = arduino.get("partitions")
    flash_size = upload.get("flash_size")
    if not isinstance(partitions, str) or not isinstance(flash_size, str):
        raise TypeError(f"{board_name} is missing partitions or flash_size")
    return BoardConfig(
        partitions=partitions,
        flash_size=flash_size,
        maximum_ram_size=json_int(
            upload.get("maximum_ram_size"), f"{board_name} maximum_ram_size"
        ),
    )


def measure_target(
    spec: TargetSpec,
    root: Path,
    boards: dict[str, str],
    size_tool: Path | None = None,
) -> TargetReport:
    """Measure one firmware or filesystem target and apply the fit check."""
    if spec.env not in boards:
        raise SystemExit(f"platformio.ini has no board for env {spec.env}")
    try:
        board = load_board(root, boards[spec.env])
    except (TypeError, KeyError, FileNotFoundError) as exc:
        raise SystemExit(f"board {boards[spec.env]} is incomplete: {exc}") from exc
    flash_chip = parse_flash_size(board.flash_size)
    ram_limit = board.maximum_ram_size
    partitions = parse_partitions_csv(
        find_partition_csv(board.partitions, root).read_text(encoding="utf-8")
    )
    table_end = partition_table_end(partitions)
    build_dir = root / ".pio" / "build" / spec.env

    if spec.kind == "fs":
        slot = find_fs_slot(partitions)
        image = build_dir / "littlefs.bin"
        if not image.is_file():
            raise SystemExit(f"missing {image}")
        used = image.stat().st_size
        errors = check_fit(
            used_flash=used,
            flash_limit=slot.size,
            used_ram=None,
            ram_limit=None,
            table_end=table_end,
            flash_chip=flash_chip,
            label=spec.name,
        )
        return TargetReport(
            name=spec.name,
            flash=used,
            flash_limit=slot.size,
            fits=not errors,
            errors=errors,
        )

    slot = find_app_slot(partitions)
    firmware = build_dir / "firmware.bin"
    if not firmware.is_file():
        raise SystemExit(f"missing {firmware}")
    used = firmware.stat().st_size
    ram = None
    elf = build_dir / "firmware.elf"
    measured = measure_elf(elf, size_tool)
    if measured is not None:
        _flash_elf, ram = measured
    errors = check_fit(
        used_flash=used,
        flash_limit=slot.size,
        used_ram=ram,
        ram_limit=ram_limit,
        table_end=table_end,
        flash_chip=flash_chip,
        label=spec.name,
    )
    return TargetReport(
        name=spec.name,
        flash=used,
        flash_limit=slot.size,
        ram=ram,
        ram_limit=ram_limit,
        fits=not errors,
        errors=errors,
    )


def collect_reports(
    root: Path,
    target_names: list[str] | None = None,
    size_tool: Path | None = None,
) -> dict[str, TargetReport]:
    """Measure the selected targets under root."""
    ini = root / "platformio.ini"
    boards = pio_env_boards(ini.read_text(encoding="utf-8"))
    selected = DEFAULT_TARGETS
    if target_names:
        wanted = set(target_names)
        selected = tuple(spec for spec in DEFAULT_TARGETS if spec.name in wanted)
        missing = wanted - {spec.name for spec in selected}
        if missing:
            raise SystemExit(f"unknown targets: {', '.join(sorted(missing))}")
    return {
        spec.name: measure_target(spec, root, boards, size_tool) for spec in selected
    }


def resolve_baseline(
    path: Path | None,
    jail: Path | None = None,
) -> tuple[str | None, dict[str, TargetReport] | None]:
    """Load a baseline JSON if the path exists."""
    if path is None:
        return None, None
    safe = resolve_inside(jail, path) if jail is not None else path
    if not safe.is_file():
        return None, None
    payload = as_object(json.loads(safe.read_text(encoding="utf-8")), "baseline")
    commit, reports = reports_from_json(payload)
    return commit or None, reports


def current_commit(root: Path) -> str:
    """Best-effort git revision for the report header."""
    env_sha = os.environ.get("GITHUB_SHA")
    if env_sha:
        return env_sha
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
    return result.stdout.strip() or "unknown"


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Write out/sizes.json")
    parser.add_argument("--markdown", action="store_true", help="Write out/sizes.md")
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Compare against baseline/sizes.json if present",
    )
    parser.add_argument("--commit", default="", help="Override current commit SHA")
    parser.add_argument(
        "--targets",
        default="",
        help="Comma-separated target names (default: all shipping images)",
    )
    args = parser.parse_args(argv)

    root = Path.cwd().resolve()
    names = [part.strip() for part in args.targets.split(",") if part.strip()]
    reports = collect_reports(root, names or None)
    commit = args.commit or current_commit(root)
    baseline_file = BASELINE_REPORT if args.baseline else None
    baseline_commit, baseline = resolve_baseline(baseline_file)

    markdown = render_markdown(reports, baseline, commit, baseline_commit)
    print(markdown)
    if args.markdown:
        MARKDOWN_REPORT.parent.mkdir(parents=True, exist_ok=True)
        MARKDOWN_REPORT.write_text(markdown, encoding="utf-8")
    if args.json:
        JSON_REPORT.parent.mkdir(parents=True, exist_ok=True)
        JSON_REPORT.write_text(
            json.dumps(reports_to_json(reports, commit), indent=2) + "\n",
            encoding="utf-8",
        )

    errors = [error for report in reports.values() for error in report.errors]
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
