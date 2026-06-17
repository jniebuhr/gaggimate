/* Simulator copy of the embedded WebUI blob.
 * The generated src/display/webassets/web_ui_blob.S emits the symbol without a
 * leading underscore, which is correct for xtensa/Linux but wrong for macOS
 * Mach-O (C symbols are prefixed with '_'). This variant handles both, and takes
 * the .bin path from the GM_WEB_UI_BIN macro (set in platformio.ini). */
    .data
    .align 4
#if defined(__APPLE__)
    .global _gWebUiBlobStart
_gWebUiBlobStart:
    .incbin GM_WEB_UI_BIN
    .global _gWebUiBlobEnd
_gWebUiBlobEnd:
#else
    .global gWebUiBlobStart
gWebUiBlobStart:
    .incbin GM_WEB_UI_BIN
    .global gWebUiBlobEnd
gWebUiBlobEnd:
#endif
    .align 4
