#ifndef EEZ_LVGL_UI_STRUCTS_H
#define EEZ_LVGL_UI_STRUCTS_H

#include "eez-flow.h"

#include <stdbool.h>
#include <stdint.h>

#include "vars.h"

using eez::ArrayOf;
using eez::BooleanValue;
using eez::FloatValue;
using eez::IntegerValue;
using eez::StringValue;
using eez::Value;

enum FlowStructures {
    FLOW_STRUCTURE_SYSTEM_STATUS = 16384,
    FLOW_STRUCTURE_PROFILE_INFO = 16385,
    FLOW_STRUCTURE_BOILER = 16386,
    FLOW_STRUCTURE_UI_FLAGS = 16387,
    FLOW_STRUCTURE_BREW_PROCESS = 16388
};

enum FlowArrayOfStructures {
    FLOW_ARRAY_OF_STRUCTURE_SYSTEM_STATUS = 81920,
    FLOW_ARRAY_OF_STRUCTURE_PROFILE_INFO = 81921,
    FLOW_ARRAY_OF_STRUCTURE_BOILER = 81922,
    FLOW_ARRAY_OF_STRUCTURE_UI_FLAGS = 81923,
    FLOW_ARRAY_OF_STRUCTURE_BREW_PROCESS = 81924
};

enum SystemStatusFlowStructureFields {
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH = 0,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_UPDATE_AVAILABLE = 1,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_WIFI = 2,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR = 3,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR_LABEL = 4,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_TIME = 5,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_VOLUMETRIC_AVAILABLE = 6,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_CONTROLLER_VERSION = 7,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_DISPLAY_VERSION = 8,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_IN_MENU = 9,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_PRESSURE_AVAILABLE = 10,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH_SCALES = 11,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_GRIND_AVAILABLE = 12,
    FLOW_STRUCTURE_SYSTEM_STATUS_NUM_FIELDS
};

enum ProfileInfoFlowStructureFields {
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_NAME = 0,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_TEMPERATURE = 1,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_TIME = 2,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_PHASES = 3,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_STEPS = 4,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_IS_VOLUMETRIC = 5,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_IS_CURRENT = 6,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_TARGET_WEIGHT = 7,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_DIRTY = 8,
    FLOW_STRUCTURE_PROFILE_INFO_NUM_FIELDS
};

enum BoilerFlowStructureFields {
    FLOW_STRUCTURE_BOILER_FIELD_CURRENT_PRESSURE = 0,
    FLOW_STRUCTURE_BOILER_FIELD_TARGET_PRESSURE = 1,
    FLOW_STRUCTURE_BOILER_FIELD_CURRENT_TEMPERATURE = 2,
    FLOW_STRUCTURE_BOILER_FIELD_TARGET_TEMPERATURE = 3,
    FLOW_STRUCTURE_BOILER_FIELD_MAX_PRESSURE = 4,
    FLOW_STRUCTURE_BOILER_FIELD_MAX_TEMPERATURE = 5,
    FLOW_STRUCTURE_BOILER_NUM_FIELDS
};

enum UIFlagsFlowStructureFields {
    FLOW_STRUCTURE_UI_FLAGS_FIELD_BREW_ADJUSTMENTS = 0,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_GRIND_ACTIVE = 1,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_ACTIVE = 2,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_GRIND_VOLUMETRIC = 3,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_HEATING_FLASH = 4,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_TEMPERATURE_STABLE = 5,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_HAS_PREV_PROFILE = 6,
    FLOW_STRUCTURE_UI_FLAGS_FIELD_HAS_NEXT_PROFILE = 7,
    FLOW_STRUCTURE_UI_FLAGS_NUM_FIELDS
};

enum BrewProcessFlowStructureFields {
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_BOILER_TARGET_TEMPERATURE = 0,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TEMPERATURE = 1,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TIME = 2,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_PHASES = 3,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_STEPS = 4,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_IS_VOLUMETRIC = 5,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_IS_CURRENT = 6,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TARGET_WEIGHT = 7,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_TYPE = 8,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_NAME = 9,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_CURRENT = 10,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_TARGET = 11,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_IS_WEIGHT = 12,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_ELAPSED_TIME = 13,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_ELAPSED_PERCENTAGE = 14,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_IS_COMPLETE = 15,
    FLOW_STRUCTURE_BREW_PROCESS_FIELD_CURRENT_VOLUME = 16,
    FLOW_STRUCTURE_BREW_PROCESS_NUM_FIELDS
};

struct SystemStatusValue {
    Value value;

    SystemStatusValue() { value = Value::makeArrayRef(FLOW_STRUCTURE_SYSTEM_STATUS_NUM_FIELDS, FLOW_STRUCTURE_SYSTEM_STATUS, 0); }

    SystemStatusValue(Value value) : value(value) {}

    operator Value() const { return value; }

    operator bool() const { return value.isArray(); }

    bool bluetooth() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH].getBoolean(); }
    void bluetooth(bool bluetooth) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH] = BooleanValue(bluetooth);
    }

    bool update_available() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_UPDATE_AVAILABLE].getBoolean(); }
    void update_available(bool update_available) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_UPDATE_AVAILABLE] = BooleanValue(update_available);
    }

    bool wifi() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_WIFI].getBoolean(); }
    void wifi(bool wifi) { value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_WIFI] = BooleanValue(wifi); }

    bool error() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR].getBoolean(); }
    void error(bool error) { value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR] = BooleanValue(error); }

    const char *error_label() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR_LABEL].getString(); }
    void error_label(const char *error_label) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR_LABEL] = StringValue(error_label);
    }

    const char *time() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_TIME].getString(); }
    void time(const char *time) { value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_TIME] = StringValue(time); }

    bool volumetric_available() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_VOLUMETRIC_AVAILABLE].getBoolean();
    }
    void volumetric_available(bool volumetric_available) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_VOLUMETRIC_AVAILABLE] = BooleanValue(volumetric_available);
    }

    const char *controller_version() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_CONTROLLER_VERSION].getString();
    }
    void controller_version(const char *controller_version) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_CONTROLLER_VERSION] = StringValue(controller_version);
    }

    const char *display_version() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_DISPLAY_VERSION].getString();
    }
    void display_version(const char *display_version) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_DISPLAY_VERSION] = StringValue(display_version);
    }

    bool in_menu() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_IN_MENU].getBoolean(); }
    void in_menu(bool in_menu) { value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_IN_MENU] = BooleanValue(in_menu); }

    bool pressure_available() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_PRESSURE_AVAILABLE].getBoolean();
    }
    void pressure_available(bool pressure_available) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_PRESSURE_AVAILABLE] = BooleanValue(pressure_available);
    }

    bool bluetooth_scales() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH_SCALES].getBoolean(); }
    void bluetooth_scales(bool bluetooth_scales) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH_SCALES] = BooleanValue(bluetooth_scales);
    }

    bool grind_available() { return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_GRIND_AVAILABLE].getBoolean(); }
    void grind_available(bool grind_available) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_GRIND_AVAILABLE] = BooleanValue(grind_available);
    }
};

typedef ArrayOf<SystemStatusValue, FLOW_ARRAY_OF_STRUCTURE_SYSTEM_STATUS> ArrayOfSystemStatusValue;
struct ProfileInfoValue {
    Value value;

    ProfileInfoValue() { value = Value::makeArrayRef(FLOW_STRUCTURE_PROFILE_INFO_NUM_FIELDS, FLOW_STRUCTURE_PROFILE_INFO, 0); }

    ProfileInfoValue(Value value) : value(value) {}

    operator Value() const { return value; }

    operator bool() const { return value.isArray(); }

    const char *name() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_NAME].getString(); }
    void name(const char *name) { value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_NAME] = StringValue(name); }

    float temperature() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TEMPERATURE].getFloat(); }
    void temperature(float temperature) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TEMPERATURE] = FloatValue(temperature);
    }

    const char *time() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TIME].getString(); }
    void time(const char *time) { value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TIME] = StringValue(time); }

    int phases() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_PHASES].getInt(); }
    void phases(int phases) { value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_PHASES] = IntegerValue(phases); }

    int steps() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_STEPS].getInt(); }
    void steps(int steps) { value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_STEPS] = IntegerValue(steps); }

    bool is_volumetric() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_IS_VOLUMETRIC].getBoolean(); }
    void is_volumetric(bool is_volumetric) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_IS_VOLUMETRIC] = BooleanValue(is_volumetric);
    }

    bool is_current() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_IS_CURRENT].getBoolean(); }
    void is_current(bool is_current) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_IS_CURRENT] = BooleanValue(is_current);
    }

    float target_weight() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TARGET_WEIGHT].getFloat(); }
    void target_weight(float target_weight) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TARGET_WEIGHT] = FloatValue(target_weight);
    }

    bool dirty() { return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_DIRTY].getBoolean(); }
    void dirty(bool dirty) { value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_DIRTY] = BooleanValue(dirty); }
};

typedef ArrayOf<ProfileInfoValue, FLOW_ARRAY_OF_STRUCTURE_PROFILE_INFO> ArrayOfProfileInfoValue;
struct BoilerValue {
    Value value;

    BoilerValue() { value = Value::makeArrayRef(FLOW_STRUCTURE_BOILER_NUM_FIELDS, FLOW_STRUCTURE_BOILER, 0); }

    BoilerValue(Value value) : value(value) {}

    operator Value() const { return value; }

    operator bool() const { return value.isArray(); }

    float current_pressure() { return value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_CURRENT_PRESSURE].getFloat(); }
    void current_pressure(float current_pressure) {
        value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_CURRENT_PRESSURE] = FloatValue(current_pressure);
    }

    float target_pressure() { return value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_TARGET_PRESSURE].getFloat(); }
    void target_pressure(float target_pressure) {
        value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_TARGET_PRESSURE] = FloatValue(target_pressure);
    }

    float current_temperature() { return value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_CURRENT_TEMPERATURE].getFloat(); }
    void current_temperature(float current_temperature) {
        value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_CURRENT_TEMPERATURE] = FloatValue(current_temperature);
    }

    float target_temperature() { return value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_TARGET_TEMPERATURE].getFloat(); }
    void target_temperature(float target_temperature) {
        value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_TARGET_TEMPERATURE] = FloatValue(target_temperature);
    }

    float max_pressure() { return value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_MAX_PRESSURE].getFloat(); }
    void max_pressure(float max_pressure) {
        value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_MAX_PRESSURE] = FloatValue(max_pressure);
    }

    float max_temperature() { return value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_MAX_TEMPERATURE].getFloat(); }
    void max_temperature(float max_temperature) {
        value.getArray()->values[FLOW_STRUCTURE_BOILER_FIELD_MAX_TEMPERATURE] = FloatValue(max_temperature);
    }
};

typedef ArrayOf<BoilerValue, FLOW_ARRAY_OF_STRUCTURE_BOILER> ArrayOfBoilerValue;
struct UIFlagsValue {
    Value value;

    UIFlagsValue() { value = Value::makeArrayRef(FLOW_STRUCTURE_UI_FLAGS_NUM_FIELDS, FLOW_STRUCTURE_UI_FLAGS, 0); }

    UIFlagsValue(Value value) : value(value) {}

    operator Value() const { return value; }

    operator bool() const { return value.isArray(); }

    bool brew_adjustments() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_BREW_ADJUSTMENTS].getBoolean(); }
    void brew_adjustments(bool brew_adjustments) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_BREW_ADJUSTMENTS] = BooleanValue(brew_adjustments);
    }

    bool grind_active() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_GRIND_ACTIVE].getBoolean(); }
    void grind_active(bool grind_active) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_GRIND_ACTIVE] = BooleanValue(grind_active);
    }

    bool active() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_ACTIVE].getBoolean(); }
    void active(bool active) { value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_ACTIVE] = BooleanValue(active); }

    bool grind_volumetric() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_GRIND_VOLUMETRIC].getBoolean(); }
    void grind_volumetric(bool grind_volumetric) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_GRIND_VOLUMETRIC] = BooleanValue(grind_volumetric);
    }

    bool heating_flash() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_HEATING_FLASH].getBoolean(); }
    void heating_flash(bool heating_flash) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_HEATING_FLASH] = BooleanValue(heating_flash);
    }

    bool temperature_stable() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_TEMPERATURE_STABLE].getBoolean(); }
    void temperature_stable(bool temperature_stable) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_TEMPERATURE_STABLE] = BooleanValue(temperature_stable);
    }

    bool has_prev_profile() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_HAS_PREV_PROFILE].getBoolean(); }
    void has_prev_profile(bool has_prev_profile) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_HAS_PREV_PROFILE] = BooleanValue(has_prev_profile);
    }

    bool has_next_profile() { return value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_HAS_NEXT_PROFILE].getBoolean(); }
    void has_next_profile(bool has_next_profile) {
        value.getArray()->values[FLOW_STRUCTURE_UI_FLAGS_FIELD_HAS_NEXT_PROFILE] = BooleanValue(has_next_profile);
    }
};

typedef ArrayOf<UIFlagsValue, FLOW_ARRAY_OF_STRUCTURE_UI_FLAGS> ArrayOfUIFlagsValue;
struct BrewProcessValue {
    Value value;

    BrewProcessValue() { value = Value::makeArrayRef(FLOW_STRUCTURE_BREW_PROCESS_NUM_FIELDS, FLOW_STRUCTURE_BREW_PROCESS, 0); }

    BrewProcessValue(Value value) : value(value) {}

    operator Value() const { return value; }

    operator bool() const { return value.isArray(); }

    float boiler_target_temperature() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_BOILER_TARGET_TEMPERATURE].getFloat();
    }
    void boiler_target_temperature(float boiler_target_temperature) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_BOILER_TARGET_TEMPERATURE] =
            FloatValue(boiler_target_temperature);
    }

    float profile_temperature() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TEMPERATURE].getFloat();
    }
    void profile_temperature(float profile_temperature) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TEMPERATURE] = FloatValue(profile_temperature);
    }

    const char *profile_time() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TIME].getString(); }
    void profile_time(const char *profile_time) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TIME] = StringValue(profile_time);
    }

    int profile_phases() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_PHASES].getInt(); }
    void profile_phases(int profile_phases) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_PHASES] = IntegerValue(profile_phases);
    }

    int profile_steps() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_STEPS].getInt(); }
    void profile_steps(int profile_steps) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_STEPS] = IntegerValue(profile_steps);
    }

    bool profile_is_volumetric() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_IS_VOLUMETRIC].getBoolean();
    }
    void profile_is_volumetric(bool profile_is_volumetric) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_IS_VOLUMETRIC] = BooleanValue(profile_is_volumetric);
    }

    bool profile_is_current() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_IS_CURRENT].getBoolean();
    }
    void profile_is_current(bool profile_is_current) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_IS_CURRENT] = BooleanValue(profile_is_current);
    }

    float profile_target_weight() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TARGET_WEIGHT].getFloat();
    }
    void profile_target_weight(float profile_target_weight) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PROFILE_TARGET_WEIGHT] = FloatValue(profile_target_weight);
    }

    const char *phase_type() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_TYPE].getString(); }
    void phase_type(const char *phase_type) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_TYPE] = StringValue(phase_type);
    }

    const char *phase_name() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_NAME].getString(); }
    void phase_name(const char *phase_name) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_NAME] = StringValue(phase_name);
    }

    float phase_value_current() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_CURRENT].getFloat();
    }
    void phase_value_current(float phase_value_current) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_CURRENT] = FloatValue(phase_value_current);
    }

    float phase_value_target() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_TARGET].getFloat();
    }
    void phase_value_target(float phase_value_target) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_TARGET] = FloatValue(phase_value_target);
    }

    bool phase_value_is_weight() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_IS_WEIGHT].getBoolean();
    }
    void phase_value_is_weight(bool phase_value_is_weight) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_PHASE_VALUE_IS_WEIGHT] = BooleanValue(phase_value_is_weight);
    }

    const char *elapsed_time() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_ELAPSED_TIME].getString(); }
    void elapsed_time(const char *elapsed_time) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_ELAPSED_TIME] = StringValue(elapsed_time);
    }

    float elapsed_percentage() {
        return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_ELAPSED_PERCENTAGE].getFloat();
    }
    void elapsed_percentage(float elapsed_percentage) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_ELAPSED_PERCENTAGE] = FloatValue(elapsed_percentage);
    }

    bool is_complete() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_IS_COMPLETE].getBoolean(); }
    void is_complete(bool is_complete) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_IS_COMPLETE] = BooleanValue(is_complete);
    }

    float current_volume() { return value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_CURRENT_VOLUME].getFloat(); }
    void current_volume(float current_volume) {
        value.getArray()->values[FLOW_STRUCTURE_BREW_PROCESS_FIELD_CURRENT_VOLUME] = FloatValue(current_volume);
    }
};

typedef ArrayOf<BrewProcessValue, FLOW_ARRAY_OF_STRUCTURE_BREW_PROCESS> ArrayOfBrewProcessValue;

#endif /*EEZ_LVGL_UI_STRUCTS_H*/