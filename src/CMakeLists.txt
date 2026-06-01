# GAGGIMATE_CONTROLLER_BUILD=1 selects src/controller/**; default is src/display/**.
if(DEFINED GAGGIMATE_CONTROLLER_BUILD AND GAGGIMATE_CONTROLLER_BUILD)
    FILE(GLOB_RECURSE app_sources
        ${CMAKE_SOURCE_DIR}/src/controller/*.c
        ${CMAKE_SOURCE_DIR}/src/controller/*.cpp
    )
else()
    FILE(GLOB_RECURSE app_sources
        ${CMAKE_SOURCE_DIR}/src/display/*.c
        ${CMAKE_SOURCE_DIR}/src/display/*.cpp
    )
    # Headless envs opt out of driver/ui code via -DGAGGIMATE_HEADLESS_BUILD=1.
    if(DEFINED GAGGIMATE_HEADLESS_BUILD AND GAGGIMATE_HEADLESS_BUILD)
        list(FILTER app_sources EXCLUDE REGEX "/src/display/drivers/")
        list(FILTER app_sources EXCLUDE REGEX "/src/display/ui/")
    endif()
endif()

idf_component_register(SRCS ${app_sources}
    INCLUDE_DIRS ${CMAKE_SOURCE_DIR}/src
    REQUIRES esp-nimble-cpp
)

target_compile_options(${COMPONENT_LIB} PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:-std=gnu++20>
)
