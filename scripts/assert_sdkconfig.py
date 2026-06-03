# ruff: noqa: F821 — `env` is injected by PlatformIO/SCons at runtime
#
# Post-build guard against silent sdkconfig drift.
#
# The dual-framework (pioarduino) build compiles ESP-IDF from source, so any
# config we don't pin in sdkconfig.*.defaults falls back to IDF's Kconfig
# default — which differs from the prebuilt sdkconfig the old pure-Arduino build
# used. That bit us once already: IDF 5.5 defaults FATFS to LFN_NONE (8.3 names
# only), which made SD-card files with 4-char extensions (".slog"/".json")
# unreadable and broke shot loading in the web UI ("Bad magic"). This guard
# fails the build if a required invariant regresses, so the class can't ship
# again unnoticed. Add new invariants to REQUIRED below as they're discovered.
import os

Import("env")

# Each entry: (human description, predicate(text) -> bool, remediation hint).
# `text` is the merged sdkconfig.h emitted into the build's config/ dir.
REQUIRED = [
    (
        "FATFS long filenames enabled (LFN_HEAP or LFN_STACK; NOT LFN_NONE)",
        lambda t: ("#define CONFIG_FATFS_LFN_HEAP 1" in t
                   or "#define CONFIG_FATFS_LFN_STACK 1" in t)
        and "#define CONFIG_FATFS_LFN_NONE 1" not in t,
        "Set CONFIG_FATFS_LFN_HEAP=y + CONFIG_FATFS_MAX_LFN=255 in "
        "sdkconfig.common.defaults, then `pio run -e <env> -t fullclean`.",
    ),
]


def assert_sdkconfig(*_args, **_kwargs):
    sdkconfig_h = os.path.join(env.subst("$BUILD_DIR"), "config", "sdkconfig.h")
    if not os.path.isfile(sdkconfig_h):
        # No merged config (e.g. native env) — nothing to assert.
        return
    with open(sdkconfig_h, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()

    failures = []
    for desc, predicate, hint in REQUIRED:
        if not predicate(text):
            failures.append((desc, hint))

    if failures:
        print("\n*** sdkconfig guard FAILED — merged config violates required invariants:")
        for desc, hint in failures:
            print(f"  - {desc}\n      fix: {hint}")
        print(f"  (checked {sdkconfig_h})\n")
        env.Exit(1)
    else:
        print("sdkconfig guard: OK (%d invariant(s) satisfied)" % len(REQUIRED))


# Run after the firmware ELF is built, so the merged sdkconfig.h exists.
env.AddPostAction("$BUILD_DIR/${PROGNAME}.elf", assert_sdkconfig)
