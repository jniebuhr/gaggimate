# The simulator embeds src/display/webassets/web_ui.bin via a static .S with .incbin, which SCons
# cannot see as a dependency. Bump the .S mtime whenever the .bin is newer so the blob is re-assembled.
import os

Import("env")

PROJECT_DIR = env["PROJECT_DIR"]
BLOB_S = os.path.join(PROJECT_DIR, "sim", "web", "web_ui_blob_sim.S")
WEB_UI_BIN = os.path.join(PROJECT_DIR, "src", "display", "webassets", "web_ui.bin")

if os.path.exists(BLOB_S) and os.path.exists(WEB_UI_BIN) and os.path.getmtime(WEB_UI_BIN) > os.path.getmtime(BLOB_S):
    os.utime(BLOB_S, None)
    print("sim_webui_dep: web_ui.bin is newer than the blob stub, forcing re-embed")
