cmake_minimum_required(VERSION 3.16.0)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)

# esp-matter / CHIP require these at project scope.
idf_build_set_property(CXX_COMPILE_OPTIONS
    "-std=gnu++17;-DCHIP_HAVE_CONFIG_H;-Wno-overloaded-virtual" APPEND)
idf_build_set_property(COMPILE_OPTIONS
    "-Wno-format-nonliteral;-Wno-format-security" APPEND)

project(gaggimate)
