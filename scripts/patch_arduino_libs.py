"""Strip Arduino libraries that don't compile under IDF 5.5.4 + GCC 14 or
that we don't need under dual-framework (framework = arduino, espidf), plus
patch HTTPClient.h for the GCC 14 RequestArgument ctor regression.

Kconfig `ARDUINO_SELECTIVE_*` disables are unreliable (kconfig parser ignores
`# CONFIG_X is not set` when `default y; depends on COMPILATION` latches).
Direct `list(REMOVE_ITEM ARDUINO_ALL_LIBRARIES ...)` patch is the only
reproducible fix. Idempotent — safe to rerun on every build.

Ported from feature/matter-migration trimmed for the pure-BLE branch: keeps
HTTPClient.h GCC 14 patch (we still use HTTPClient via lib_deps); strips libs
we don't use + ones that break under IDF 5.5/GCC 14.
"""
from pathlib import Path

Import("env")  # noqa: F821 — provided by PlatformIO

SENTINEL = "# GaggiMate: strip libs that break IDF 5.5 + GCC 14"
STRIP = (
    "list(REMOVE_ITEM ARDUINO_ALL_LIBRARIES "
    "ESP_SR Zigbee BluetoothSerial Matter Insights RainMaker "
    "OpenThread SimpleBLE ESP_HostedOTA)"
)


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


def _patch_cmakelists(text):
    anchor = "set(ARDUINO_LIBRARIES_SRCS)"
    if anchor not in text:
        raise RuntimeError(
            f"patch_arduino_libs: anchor '{anchor}' not found in CMakeLists.txt; "
            "pioarduino layout changed, update the script."
        )
    return text.replace(anchor, f"{anchor}\n{SENTINEL}\n{STRIP}", 1)


_patch_file(framework_dir / "CMakeLists.txt", "CMakeLists.txt", SENTINEL, _patch_cmakelists)


# HTTPClient.h — GCC 14 rejects emplace_back(h,v) without an explicit ctor
# on the aggregate RequestArgument. Add it so the library compiles.
HTTP_SENTINEL = "// GaggiMate: explicit RequestArgument ctor for GCC 14"
HTTP_OLD = "  struct RequestArgument {\n    String key;\n    String value;\n  };"
HTTP_NEW = (
    "  struct RequestArgument {\n"
    "    String key;\n"
    "    String value;\n"
    "    " + HTTP_SENTINEL + "\n"
    "    RequestArgument() = default;\n"
    "    RequestArgument(const String &k, const String &v) : key(k), value(v) {}\n"
    "  };"
)


def _patch_httpclient(text):
    if HTTP_OLD not in text:
        print("*** patch_arduino_libs: HTTPClient.h structure changed, skipping ***")
        return None
    return text.replace(HTTP_OLD, HTTP_NEW, 1)


_patch_file(
    framework_dir / "libraries" / "HTTPClient" / "src" / "HTTPClient.h",
    "HTTPClient.h",
    HTTP_SENTINEL,
    _patch_httpclient,
)
