#!/usr/bin/env bash
# Build + run the offscreen simulator of the on-device bean-picker screens.
# Usage (host, needs docker):  sim/build.sh          -> builds image, compiles, runs, writes sim/out/*.png
#        (inside container):    sim/build.sh --native
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${1:-}" != "--native" ]]; then
    docker build -q -t gm-sim "$ROOT/sim" >/dev/null
    exec docker run --rm -u "$(id -u):$(id -g)" -v "$ROOT:/w" -w /w gm-sim bash sim/build.sh --native
fi

LV="$ROOT/.pio/libdeps/display/lvgl"
UI="$ROOT/src/display/ui/default"
B="$ROOT/sim/build"
OUT="$ROOT/sim/out"
[[ -d "$LV" ]] || { echo "LVGL not found at $LV — run 'pio run -e display' once first"; exit 1; }
mkdir -p "$B/obj" "$B/ui/default" "$OUT"
rm -f "$OUT"/*.raw "$OUT"/*.png

# lv_conf for the host: LVGL's own allocator, our own tick, object asserts on.
sed -e 's/^#define LV_MEM_CUSTOM 1/#define LV_MEM_CUSTOM 0/' \
    -e 's/#define LV_MEM_SIZE .*/#define LV_MEM_SIZE (32U * 1024U * 1024U)/' \
    -e 's/^#define LV_TICK_CUSTOM 1/#define LV_TICK_CUSTOM 0/' \
    -e 's/#define LV_USE_ASSERT_OBJ .*/#define LV_USE_ASSERT_OBJ 1/' \
    -e 's/#define LV_USE_ASSERT_MEM .*/#define LV_USE_ASSERT_MEM 1/' \
    -e 's/#define LV_USE_ASSERT_STYLE .*/#define LV_USE_ASSERT_STYLE 1/' \
    -e 's/#define LV_ASSERT_HANDLER .*/#define LV_ASSERT_HANDLER __builtin_printf("LVGL ASSERT at %s:%d\\n", __FILE__, __LINE__); __builtin_trap();/' \
    -e 's/^#define LV_USE_LOG 0/#define LV_USE_LOG 1/' \
    -e 's/#define LV_LOG_LEVEL .*/#define LV_LOG_LEVEL LV_LOG_LEVEL_WARN/' \
    -e 's/#define LV_LOG_PRINTF .*/#define LV_LOG_PRINTF 1/' \
    "$ROOT/src/display/lv_conf.h" > "$B/lv_conf.h"
grep -q "__builtin_trap" "$B/lv_conf.h" || echo "warning: LV_ASSERT_HANDLER not patched (LVGL asserts would spin forever)"

# BeanScreens.cpp is compiled from a copy so its "../../main.h" resolves to the
# simulator stub instead of the firmware's main.h; "lvgl/ui.h" resolves to the
# real generated UI through a symlink.
ln -sfn "$UI/lvgl" "$B/ui/default/lvgl"
cp "$UI/BeanScreens.cpp" "$UI/BeanScreens.h" "$B/ui/default/"
python3 "$ROOT/sim/gen_ui_events_stubs.py" "$UI/lvgl/ui_events.h" "$B/ui_events_stubs.c" \
    onMenuClick onBeanScreen onGrindScreen onBrewScreen onSteamScreen onWaterScreen onStandby onWakeup

CFLAGS="-O1 -g -w -DLV_CONF_INCLUDE_SIMPLE -I$B -I$LV -I$ROOT/sim/stubs -I$B/ui/default"
CXXFLAGS="$CFLAGS -std=c++17"

mapfile -t CSRC < <(find "$LV/src" -name '*.c'; ls "$UI/lvgl"/ui.c "$UI/lvgl"/ui_helpers.c "$UI"/lvgl/components/*.c "$UI"/lvgl/images/*.c "$UI"/lvgl/screens/*.c "$B/ui_events_stubs.c")
CXXSRC=("$UI/lvgl/ui_theme_manager.cpp" "$UI/lvgl/ui_themes.cpp" "$B/ui/default/BeanScreens.cpp" "$ROOT/sim/ui_events_sim.cpp" "$ROOT/sim/main.cpp")

echo "compiling ${#CSRC[@]} C + ${#CXXSRC[@]} C++ files..."
compile() { # $1=src -> object path derived from a hash of the path
    local src="$1" obj="$B/obj/$(echo "$1" | md5sum | cut -c1-16).o"
    if [[ "$src" == *.cpp ]]; then g++ $CXXFLAGS -c "$src" -o "$obj"; else gcc $CFLAGS -c "$src" -o "$obj"; fi
}
export -f compile; export B CFLAGS CXXFLAGS
printf '%s\n' "${CSRC[@]}" "${CXXSRC[@]}" | xargs -P "$(nproc)" -I{} bash -c 'compile "$@"' _ {}
g++ "$B"/obj/*.o -o "$B/sim" -lm
echo "running..."
status=0
"$B/sim" "$OUT" || status=$?
python3 "$ROOT/sim/png.py" "$OUT"/*.raw >/dev/null
rm -f "$OUT"/*.raw
ls "$OUT"
exit $status
