"""Patch HTTPClient.h for GCC 14 + IDF 5.5.4 dual-framework builds.

GCC 14 rejects emplace_back(h,v) on aggregates without an explicit ctor.
Idempotent — safe to rerun on every build.
"""
from pathlib import Path

Import("env")  # noqa: F821 — provided by PlatformIO


def _resolved_under(path, parent):
    try:
        path_r = path.resolve(strict=True)
        parent_r = parent.resolve(strict=True)
    except OSError:
        return False
    return parent_r in path_r.parents


platform = env.PioPlatform()
framework_path = platform.get_package_dir("framework-arduinoespressif32")
if not framework_path:
    print("*** patch_arduino_libs: framework-arduinoespressif32 not installed, skipping ***")
    Return()  # noqa: F821

framework_dir = Path(framework_path)
try:
    _resolved_framework = framework_dir.resolve(strict=True)
except OSError as exc:
    raise RuntimeError(f"patch_arduino_libs: cannot resolve {framework_dir}: {exc}")
if _resolved_framework.parent.name != "packages":
    raise RuntimeError(
        f"patch_arduino_libs: refusing to patch {_resolved_framework} — its "
        "parent directory is not named 'packages'. Check your PIO setup."
    )


def _patch_file(target, expected_name, sentinel, patcher):
    if target.name != expected_name:
        raise RuntimeError(f"patch_arduino_libs: unexpected filename {target}")
    if not _resolved_under(target, framework_dir):
        raise RuntimeError(
            f"patch_arduino_libs: {target} resolves outside {framework_dir}; refusing to write."
        )
    if not target.is_file():
        print(f"*** patch_arduino_libs: {target} not found, skipping ***")
        return
    text = target.read_text()
    if sentinel in text:
        return
    new_text = patcher(text)
    if new_text is None:
        return
    target.write_text(new_text)
    print(f"*** patch_arduino_libs: patched {target} ***")


SENTINEL = "// GaggiMate: explicit RequestArgument ctor for GCC 14"
OLD = "  struct RequestArgument {\n    String key;\n    String value;\n  };"
NEW = (
    "  struct RequestArgument {\n"
    "    String key;\n"
    "    String value;\n"
    "    " + SENTINEL + "\n"
    "    RequestArgument() = default;\n"
    "    RequestArgument(const String &k, const String &v) : key(k), value(v) {}\n"
    "  };"
)


def _patch_httpclient(text):
    if OLD not in text:
        print("*** patch_arduino_libs: HTTPClient.h structure changed, skipping ***")
        return None
    return text.replace(OLD, NEW, 1)


_patch_file(
    framework_dir / "libraries" / "HTTPClient" / "src" / "HTTPClient.h",
    "HTTPClient.h",
    SENTINEL,
    _patch_httpclient,
)
