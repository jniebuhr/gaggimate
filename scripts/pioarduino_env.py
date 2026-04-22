# ruff: noqa: F821 — `env` is injected by PlatformIO/SCons at runtime
import os

Import("env")

env.Append(CXXFLAGS=["-Wno-deprecated-enum-enum-conversion"])

# Only needed under dual-framework: under pure arduino, pioarduino-build.py
# already injects framework/libraries CPPPATH globally.
#
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
if "espidf" not in env.subst("$PIOFRAMEWORK"):
    Return()  # noqa: F821

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
]

platform = env.PioPlatform()
framework_dir = platform.get_package_dir("framework-arduinoespressif32")
if framework_dir:
    libraries_dir = os.path.join(framework_dir, "libraries")
    for name in ARDUINO_LIBS_ALLOWLIST:
        src = os.path.join(libraries_dir, name, "src")
        if os.path.isdir(src):
            env.Append(CXXFLAGS=["-I" + src])
