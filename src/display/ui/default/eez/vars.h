#ifndef EEZ_LVGL_UI_VARS_H
#define EEZ_LVGL_UI_VARS_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// enum declarations

// Flow global variables

enum FlowGlobalVariables {
    FLOW_GLOBAL_VARIABLE_SCALE_WEIGHT_CURRENT = 0,
    FLOW_GLOBAL_VARIABLE_GRIND_WEIGHT_TARGET = 1,
    FLOW_GLOBAL_VARIABLE_GRIND_TIME_TARGET = 2,
    FLOW_GLOBAL_VARIABLE_SYSTEM = 3,
    FLOW_GLOBAL_VARIABLE_PREVIEW_PROFILE = 4,
    FLOW_GLOBAL_VARIABLE_SELECTED_PROFILE = 5,
    FLOW_GLOBAL_VARIABLE_BOILER = 6,
    FLOW_GLOBAL_VARIABLE_UI_FLAGS = 7,
    FLOW_GLOBAL_VARIABLE_BREW_PROCESS_INFO = 8
};

// Native global variables

#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_VARS_H*/