#ifndef EEZ_LVGL_UI_STRUCTS_H
#define EEZ_LVGL_UI_STRUCTS_H

#include "eez-flow.h"

#include <stdint.h>
#include <stdbool.h>

#include "vars.h"

using namespace eez;

enum FlowStructures {
    FLOW_STRUCTURE_SYSTEM_STATUS = 16384,
    FLOW_STRUCTURE_PROFILE_INFO = 16385
};

enum FlowArrayOfStructures {
    FLOW_ARRAY_OF_STRUCTURE_SYSTEM_STATUS = 81920,
    FLOW_ARRAY_OF_STRUCTURE_PROFILE_INFO = 81921
};

enum SystemStatusFlowStructureFields {
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH = 0,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_UPDATE_AVAILABLE = 1,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_WIFI = 2,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR = 3,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR_LABEL = 4,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_TIME = 5,
    FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_SCALE_CONNECTED = 6,
    FLOW_STRUCTURE_SYSTEM_STATUS_NUM_FIELDS
};

enum ProfileInfoFlowStructureFields {
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_NAME = 0,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_TEMPERATURE = 1,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_TIME = 2,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_PHASES = 3,
    FLOW_STRUCTURE_PROFILE_INFO_FIELD_STEPS = 4,
    FLOW_STRUCTURE_PROFILE_INFO_NUM_FIELDS
};

struct SystemStatusValue {
    Value value;
    
    SystemStatusValue() {
        value = Value::makeArrayRef(FLOW_STRUCTURE_SYSTEM_STATUS_NUM_FIELDS, FLOW_STRUCTURE_SYSTEM_STATUS, 0);
    }
    
    SystemStatusValue(Value value) : value(value) {}
    
    operator Value() const { return value; }
    
    operator bool() const { return value.isArray(); }
    
    bool bluetooth() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH].getBoolean();
    }
    void bluetooth(bool bluetooth) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_BLUETOOTH] = BooleanValue(bluetooth);
    }
    
    bool update_available() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_UPDATE_AVAILABLE].getBoolean();
    }
    void update_available(bool update_available) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_UPDATE_AVAILABLE] = BooleanValue(update_available);
    }
    
    bool wifi() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_WIFI].getBoolean();
    }
    void wifi(bool wifi) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_WIFI] = BooleanValue(wifi);
    }
    
    bool error() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR].getBoolean();
    }
    void error(bool error) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR] = BooleanValue(error);
    }
    
    const char *error_label() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR_LABEL].getString();
    }
    void error_label(const char *error_label) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_ERROR_LABEL] = StringValue(error_label);
    }
    
    const char *time() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_TIME].getString();
    }
    void time(const char *time) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_TIME] = StringValue(time);
    }
    
    bool scale_connected() {
        return value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_SCALE_CONNECTED].getBoolean();
    }
    void scale_connected(bool scale_connected) {
        value.getArray()->values[FLOW_STRUCTURE_SYSTEM_STATUS_FIELD_SCALE_CONNECTED] = BooleanValue(scale_connected);
    }
};

typedef ArrayOf<SystemStatusValue, FLOW_ARRAY_OF_STRUCTURE_SYSTEM_STATUS> ArrayOfSystemStatusValue;
struct ProfileInfoValue {
    Value value;
    
    ProfileInfoValue() {
        value = Value::makeArrayRef(FLOW_STRUCTURE_PROFILE_INFO_NUM_FIELDS, FLOW_STRUCTURE_PROFILE_INFO, 0);
    }
    
    ProfileInfoValue(Value value) : value(value) {}
    
    operator Value() const { return value; }
    
    operator bool() const { return value.isArray(); }
    
    const char *name() {
        return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_NAME].getString();
    }
    void name(const char *name) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_NAME] = StringValue(name);
    }
    
    float temperature() {
        return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TEMPERATURE].getFloat();
    }
    void temperature(float temperature) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TEMPERATURE] = FloatValue(temperature);
    }
    
    const char *time() {
        return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TIME].getString();
    }
    void time(const char *time) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_TIME] = StringValue(time);
    }
    
    const char *phases() {
        return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_PHASES].getString();
    }
    void phases(const char *phases) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_PHASES] = StringValue(phases);
    }
    
    const char *steps() {
        return value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_STEPS].getString();
    }
    void steps(const char *steps) {
        value.getArray()->values[FLOW_STRUCTURE_PROFILE_INFO_FIELD_STEPS] = StringValue(steps);
    }
};

typedef ArrayOf<ProfileInfoValue, FLOW_ARRAY_OF_STRUCTURE_PROFILE_INFO> ArrayOfProfileInfoValue;

#endif /*EEZ_LVGL_UI_STRUCTS_H*/