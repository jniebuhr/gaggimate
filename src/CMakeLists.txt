# PlatformIO auto-generated fallback for dual-framework (arduino+espidf)
# gets replaced here because env:display only wants src/display/** plus
# version.h. src/controller/** is a plain-arduino PlatformIO env that
# doesn't go through IDF, so including its sources here pulls in
# ControllerConfig.h etc. that don't exist in the display tree.
FILE(GLOB_RECURSE app_sources
    ${CMAKE_SOURCE_DIR}/src/display/*.c
    ${CMAKE_SOURCE_DIR}/src/display/*.cpp
)

# Headless envs exclude driver/ui code (they depend on Arduino_GFX_Library,
# LVGL, TFT_eSPI that aren't in lib_deps for those envs). Matches PlatformIO's
# build_src_filter but applied at IDF CMake level. Enabled by passing
# -DGAGGIMATE_HEADLESS_BUILD=1 via board_build.cmake_extra_args.
if(DEFINED GAGGIMATE_HEADLESS_BUILD AND GAGGIMATE_HEADLESS_BUILD)
    list(FILTER app_sources EXCLUDE REGEX "/src/display/drivers/")
    list(FILTER app_sources EXCLUDE REGEX "/src/display/ui/")
endif()

idf_component_register(SRCS ${app_sources}
    INCLUDE_DIRS ${CMAKE_SOURCE_DIR}/src
)

# CHIP headers require these C++17 extensions + macros. Scope per-component
# so we don't pollute Arduino core / third-party libs.
target_compile_options(${COMPONENT_LIB} PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:-std=gnu++17>
    $<$<COMPILE_LANGUAGE:CXX>:-Wno-overloaded-virtual>
)
target_compile_definitions(${COMPONENT_LIB} PRIVATE
    CHIP_HAVE_CONFIG_H=1
)
