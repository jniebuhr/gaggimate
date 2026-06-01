# ruff: noqa: F821 — `env` is injected by PlatformIO/SCons at runtime
import os

Import("env")

env.Append(CXXFLAGS=["-Wno-deprecated-enum-enum-conversion"])

# pioarduino 55.x split WiFi → Network/NetworkClientSecure. Arduino-bundled libs
# declare transitive deps only via `#include`, not `depends=` in
# library.properties, so LDF (even `deep+`) won't wire up sibling include paths
# for every compile unit. Inject a narrow allowlist of Arduino-bundled libs
# we actually use. Keep this list tight — globbing every library pulls in
# paths for framework libs we don't need (protocol stacks, radio helpers, DSP,
# etc.) and can collide or inflate compile time.
#
# CXXFLAGS, not CPPPATH: under dual-framework or hybrid-compile builds IDF C
# sources (e.g. spiffs_api.c, sdmmc_*.c) share the project include path set
# with our C++ code. Arduino's FS.h / SPIFFS's spiffs.h are C++ headers —
# leaking them into C compilation trips `#include <memory>` with "No such
# file or directory". `-I` via CXXFLAGS applies to C++ only.
ARDUINO_LIBS_ALLOWLIST = [
    "Network",
    "NetworkClientSecure",
    "WiFi",
    "HTTPClient",
    "HTTPUpdate",
    "Update",
    "SPI",
    "Wire",
    "FS",
    "SPIFFS",
    "SD_MMC",
    "Preferences",
    "DNSServer",
    "AsyncUDP",
    "ESPmDNS",
    "Ethernet",
    "ArduinoOTA",
    "Hash",
]

platform = env.PioPlatform()
framework_dir = platform.get_package_dir("framework-arduinoespressif32")
if framework_dir:
    libraries_dir = os.path.join(framework_dir, "libraries")
    for name in ARDUINO_LIBS_ALLOWLIST:
        src = os.path.join(libraries_dir, name, "src")
        if os.path.isdir(src):
            env.Append(CXXFLAGS=["-I" + src])

# IDF BT/NimBLE include paths for esp-nimble-cpp.
# esp-nimble-cpp REQUIRES bt (IDF component), which exposes NimBLE C headers
# (host/ble_gap.h, syscfg/syscfg.h, etc.) transitively. IDF's CMake resolves
# this automatically for the IDF compilation pass, but the Arduino lib
# compilation pass doesn't receive IDF component REQUIRES propagation.
# Inject via CXXFLAGS (same cross-pass mechanism as ARDUINO_LIBS_ALLOWLIST).
#
# Paths extracted from bt/CMakeLists.txt include_dirs declarations —
# IDF uses container dirs (e.g. porting/nimble/include) not leaf dirs,
# so a naive os.walk would add wrong paths and miss header resolution.
_IDF_BT_NIMBLE_PATHS = [
    # Common BT
    "bt/common/osi/include",
    "bt/common/api/include/api",
    "bt/common/btc/profile/esp/blufi/include",
    "bt/common/btc/profile/esp/include",
    "bt/common/hci_log/include",
    "bt/common/ble_log/include",
    "bt/common/tinycrypt/include",
    "bt/common/tinycrypt/port",
    # NimBLE host
    "bt/host/nimble/nimble/nimble/host/include",
    "bt/host/nimble/nimble/nimble/include",
    "bt/host/nimble/nimble/nimble/host/services/ans/include",
    "bt/host/nimble/nimble/nimble/host/services/bas/include",
    "bt/host/nimble/nimble/nimble/host/services/dis/include",
    "bt/host/nimble/nimble/nimble/host/services/gap/include",
    "bt/host/nimble/nimble/nimble/host/services/gatt/include",
    "bt/host/nimble/nimble/nimble/host/services/hr/include",
    "bt/host/nimble/nimble/nimble/host/services/htp/include",
    "bt/host/nimble/nimble/nimble/host/services/ias/include",
    "bt/host/nimble/nimble/nimble/host/services/ipss/include",
    "bt/host/nimble/nimble/nimble/host/services/lls/include",
    "bt/host/nimble/nimble/nimble/host/services/prox/include",
    "bt/host/nimble/nimble/nimble/host/services/cts/include",
    "bt/host/nimble/nimble/nimble/host/services/tps/include",
    "bt/host/nimble/nimble/nimble/host/services/hid/include",
    "bt/host/nimble/nimble/nimble/host/services/sps/include",
    "bt/host/nimble/nimble/nimble/host/services/cte/include",
    "bt/host/nimble/nimble/nimble/host/services/ras/include",
    "bt/host/nimble/nimble/nimble/host/util/include",
    "bt/host/nimble/nimble/nimble/host/store/ram/include",
    "bt/host/nimble/nimble/nimble/host/store/config/include",
    # NimBLE porting layer (syscfg/syscfg.h lives here)
    "bt/host/nimble/nimble/porting/nimble/include",
    "bt/host/nimble/port/include",
    "bt/host/nimble/nimble/nimble/transport/include",
    "bt/porting/include",
    "bt/host/nimble/nimble/porting/npl/freertos/include",
    "bt/host/nimble/esp-hci/include",
]
# Target-specific BT controller API. ESP32-S3 uses the esp32c3-family ABI;
# other targets (S2, C6, H2, P4) would need a different subdir — gate by MCU
# so the wrong header doesn't get pulled in on future ports.
_mcu = env.subst("$BOARD_MCU")
if _mcu in ("esp32s3", "esp32c3", "esp32c2"):
    _IDF_BT_NIMBLE_PATHS.insert(0, "bt/include/esp32c3/include")

idf_dir = platform.get_package_dir("framework-espidf")
if idf_dir:
    components_dir = os.path.join(idf_dir, "components")
    for rel_path in _IDF_BT_NIMBLE_PATHS:
        abs_path = os.path.join(components_dir, rel_path)
        if os.path.isdir(abs_path):
            env.Append(CXXFLAGS=["-I" + abs_path])

# esp-nimble-cpp managed component: C++ wrapper headers (NimBLEDevice.h etc.).
# Managed components live at project root, not inside the PlatformIO package
# tree, so they must be referenced via PROJECT_DIR.
_project_dir = env.get("PROJECT_DIR", "")
if _project_dir:
    _nimble_cpp_src = os.path.join(
        _project_dir, "managed_components", "h2zero__esp-nimble-cpp", "src"
    )
    if os.path.isdir(_nimble_cpp_src):
        env.Append(CXXFLAGS=["-I" + _nimble_cpp_src])
