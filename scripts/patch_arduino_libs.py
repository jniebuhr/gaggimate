"""Strip Arduino libraries that don't compile under IDF 5.5.4 + GCC 14 or
conflict with esp-matter: ESP_SR (missing ESP_I2S.h), HTTPClient (GCC-14
RequestArgument ctor regression), plus Matter/Insights/RainMaker/etc. whose
transitive deps clash with esp_matter@1.4.0's pins.

Kconfig `ARDUINO_SELECTIVE_*` disables are unreliable (kconfig parser ignores
`# CONFIG_X is not set` when `default y; depends on COMPILATION` latches).
Direct `list(REMOVE_ITEM ARDUINO_ALL_LIBRARIES ...)` patch is the only
reproducible fix. Idempotent — safe to rerun on every build.

Run via `extra_scripts = pre:scripts/patch_arduino_libs.py` on Matter envs.
"""
import os
from pathlib import Path

Import("env")  # noqa: F821 — provided by PlatformIO

SENTINEL = "# GaggiMate Matter: strip libs that break IDF 5.5 + esp_matter 1.4.0"
STRIP = (
    "list(REMOVE_ITEM ARDUINO_ALL_LIBRARIES "
    "ESP_SR Zigbee BluetoothSerial Matter Insights RainMaker "
    "OpenThread SimpleBLE ESP_HostedOTA HTTPClient HTTPUpdate "
    "ArduinoOTA WebServer)"
)

platform = env.PioPlatform()
framework_path = platform.get_package_dir("framework-arduinoespressif32")
if not framework_path:
    print("*** patch_arduino_libs: framework-arduinoespressif32 not installed, skipping ***")
    Return()  # noqa: F821

framework_dir = Path(framework_path)
cmakelists = framework_dir / "CMakeLists.txt"

if not cmakelists.is_file():
    print(f"*** patch_arduino_libs: {cmakelists} not found, skipping ***")
    Return()  # noqa: F821

text = cmakelists.read_text()
if SENTINEL in text:
    print("*** patch_arduino_libs: already patched ***")
else:
    anchor = "set(ARDUINO_LIBRARIES_SRCS)"
    if anchor not in text:
        raise RuntimeError(
            f"patch_arduino_libs: anchor '{anchor}' not found in {cmakelists}; "
            "pioarduino layout changed, update the script."
        )
    patched = text.replace(
        anchor,
        f"{anchor}\n{SENTINEL}\n{STRIP}",
        1,
    )
    cmakelists.write_text(patched)
    print(f"*** patch_arduino_libs: patched {cmakelists} ***")

# HTTPClient.h — PlatformIO LDF still compiles it because src/ #include's
# <HTTPClient.h>. GCC 14 rejects emplace_back(h,v) without an explicit ctor
# on the aggregate RequestArgument. Add it so the library compiles; the
# pioarduino fork hasn't picked up the upstream fix yet.
http_header = framework_dir / "libraries" / "HTTPClient" / "src" / "HTTPClient.h"
HTTP_SENTINEL = "// GaggiMate Matter: explicit RequestArgument ctor for GCC 14"
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
if http_header.is_file():
    http_text = http_header.read_text()
    if HTTP_SENTINEL in http_text:
        pass
    elif HTTP_OLD in http_text:
        http_header.write_text(http_text.replace(HTTP_OLD, HTTP_NEW, 1))
        print(f"*** patch_arduino_libs: patched {http_header} ***")
    else:
        print(f"*** patch_arduino_libs: HTTPClient.h structure changed, skipping ***")
