#
# PlatformIO pre-build hook (display envs).
#
# The web UI is embedded into the firmware app image (GM-106). The real bundle
# is produced by scripts/build_webui.sh (npm build -> gzip -> embed_webui.py) and
# lands, git-ignored, in src/display/webassets/. That step is the source of truth
# and is run explicitly in CI and locally when the UI changes.
#
# This hook only guarantees the build can compile *without* a prior web build: if
# the generated manifest is missing it drops in an empty stub so a bare
# `pio run -e display` still links (serving an empty UI). It never overwrites a
# real bundle.
#
import os
import subprocess
import sys

Import("env")  # noqa: F821 -- provided by PlatformIO/SCons

project_dir = env["PROJECT_DIR"]  # noqa: F821
out_dir = os.path.join(project_dir, "src", "display", "webassets")
manifest = os.path.join(out_dir, "web_ui_manifest.h")
packer = os.path.join(project_dir, "scripts", "embed_webui.py")
blob_bin = os.path.join(out_dir, "web_ui.bin")

if not os.path.isfile(manifest):
    print("embed_webui_pre: no web bundle found, writing stub (run build_webui.sh for the real UI)")
    subprocess.check_call([sys.executable, packer, "--out", out_dir, "--stub"])

# web_ui_blob.S only .incbin's web_ui.bin; without this, a rebuilt bundle updates
# the manifest (recompiled) but not the assembled blob (stale .S.o).
if os.path.isfile(blob_bin):
    blob_obj = os.path.join(env.subst("$BUILD_DIR"), "src", "display", "webassets", "web_ui_blob.S.o")
    env.Depends(blob_obj, blob_bin)  # noqa: F821
