# PlatformIO pre-build hook: regenerates lib/OTA/src/ca_bundle.c from lib/OTA/certs/ca_roots.pem (GM-296).
import os
import subprocess
import sys

Import("env")  # noqa: F821 -- provided by PlatformIO/SCons

project_dir = env["PROJECT_DIR"]  # noqa: F821
subprocess.check_call(
    [
        sys.executable,
        os.path.join(project_dir, "scripts", "gen_ca_bundle.py"),
        os.path.join(project_dir, "lib", "OTA", "certs", "ca_roots.pem"),
        "--out",
        os.path.join(project_dir, "lib", "OTA", "src", "ca_bundle.c"),
    ]
)
