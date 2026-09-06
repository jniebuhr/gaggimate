# The simulator embeds src/display/webassets/web_ui.bin through a static .S with .incbin, a dependency
# SCons cannot see. Declare it explicitly, and drop a blob object that is older than the .bin as a safety net
# (SCons decides by content signature, so merely touching the .S does not rebuild it).
import os

Import("env")

PROJECT_DIR = env["PROJECT_DIR"]
WEB_UI_BIN = os.path.join(PROJECT_DIR, "src", "display", "webassets", "web_ui.bin")
BLOB_OBJ = os.path.join(env.subst("$BUILD_DIR"), "sim", "web", "web_ui_blob_sim.o")

env.Depends(BLOB_OBJ, WEB_UI_BIN)

if os.path.exists(BLOB_OBJ) and os.path.exists(WEB_UI_BIN) and os.path.getmtime(WEB_UI_BIN) > os.path.getmtime(BLOB_OBJ):
    os.remove(BLOB_OBJ)
    print("sim_webui_dep: web_ui.bin changed, re-embedding the WebUI blob")
