#ifndef GAGGIMATE_COMM_H
#define GAGGIMATE_COMM_H

#include <cstdint>

// Public protocol vocabulary shared by GaggiMateClient and GaggiMateServer; firmware never sees the nanopb structs.

// Pump control mode. Integer values match gaggimate_PumpMode in the schema.
enum class PumpControlMode : uint8_t {
    Power = 0,    // drive at a fixed power percentage
    Pressure = 1, // target a pressure, flow is the limit
    Flow = 2,     // target a flow, pressure is the limit
};

// Boiler control mode. Integer values match gaggimate_BoilerMode in the schema.
enum class BoilerControlMode : uint8_t {
    Temperature = 0, // setpoint is a target temperature in degC
    Pressure = 1,    // setpoint is a target pressure in bar
};

// Per-component commands: drive several components atomically in one frame, comparable so callers send only deltas.
struct BoilerCommand {
    uint8_t index = 0;
    BoilerControlMode mode = BoilerControlMode::Temperature;
    float setpoint = 0.0f;
    bool operator==(const BoilerCommand &o) const { return index == o.index && mode == o.mode && setpoint == o.setpoint; }
    bool operator!=(const BoilerCommand &o) const { return !(*this == o); }
};
struct PumpCommand {
    uint8_t index = 0;
    PumpControlMode mode = PumpControlMode::Power;
    float power = 0.0f;
    float pressure = 0.0f;
    float flow = 0.0f;
    bool operator==(const PumpCommand &o) const {
        return index == o.index && mode == o.mode && power == o.power && pressure == o.pressure && flow == o.flow;
    }
    bool operator!=(const PumpCommand &o) const { return !(*this == o); }
};
struct RelayCommand {
    uint8_t index = 0;
    bool open = false;
    bool operator==(const RelayCommand &o) const { return index == o.index && open == o.open; }
    bool operator!=(const RelayCommand &o) const { return !(*this == o); }
};
// One LED output's target brightness; packed into a single LedControl message so multi-channel updates can't be split.
struct LedChannelCommand {
    uint8_t channel = 0;
    uint8_t brightness = 0;
    bool operator==(const LedChannelCommand &o) const { return channel == o.channel && brightness == o.brightness; }
    bool operator!=(const LedChannelCommand &o) const { return !(*this == o); }
};

// Error codes; values match gaggimate.ErrorCode and the old string protocol so existing comparisons keep working.
constexpr int ERROR_CODE_NONE = 0;
constexpr int ERROR_CODE_COMM_SEND = 1;
constexpr int ERROR_CODE_COMM_RCV = 2;
constexpr int ERROR_CODE_PROTO_ERR = 3;
constexpr int ERROR_CODE_RUNAWAY = 4;
constexpr int ERROR_CODE_TIMEOUT = 5;
// Autotune saw no reaction within its test window (distinct from TIMEOUT): no PID persist, no watchdog-disconnect UX.
constexpr int ERROR_CODE_AUTOTUNE_TIMEOUT = 6;

#endif // GAGGIMATE_COMM_H
