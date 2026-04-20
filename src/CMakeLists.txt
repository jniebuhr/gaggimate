# Only src/display/** is compiled by IDF; src/controller/** is a separate PIO env.
FILE(GLOB_RECURSE app_sources
    ${CMAKE_SOURCE_DIR}/src/display/*.c
    ${CMAKE_SOURCE_DIR}/src/display/*.cpp
)

# Headless envs opt out of driver/ui code via -DGAGGIMATE_HEADLESS_BUILD=1.
if(DEFINED GAGGIMATE_HEADLESS_BUILD AND GAGGIMATE_HEADLESS_BUILD)
    list(FILTER app_sources EXCLUDE REGEX "/src/display/drivers/")
    list(FILTER app_sources EXCLUDE REGEX "/src/display/ui/")
endif()

idf_component_register(SRCS ${app_sources}
    INCLUDE_DIRS ${CMAKE_SOURCE_DIR}/src
)

# CHIP headers need these; scope per-component to avoid polluting other libs.
target_compile_options(${COMPONENT_LIB} PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:-std=gnu++17>
    $<$<COMPILE_LANGUAGE:CXX>:-Wno-overloaded-virtual>
)
target_compile_definitions(${COMPONENT_LIB} PRIVATE
    CHIP_HAVE_CONFIG_H=1
)
