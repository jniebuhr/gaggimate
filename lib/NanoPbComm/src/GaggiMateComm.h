#ifndef GAGGIMATE_COMM_H
#define GAGGIMATE_COMM_H

#include <cstdint>

// Public protocol vocabulary shared by GaggiMateClient and GaggiMateServer.
// Firmware code only ever sees these plain types -- never the nanopb structs.

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

// Per-component commands, used to drive several components atomically in one
// frame (see GaggiMateClient::sendControlBatch).
struct BoilerCommand {
    uint8_t index = 0;
    BoilerControlMode mode = BoilerControlMode::Temperature;
    float setpoint = 0.0f;
};
struct PumpCommand {
    uint8_t index = 0;
    PumpControlMode mode = PumpControlMode::Power;
    float power = 0.0f;
    float pressure = 0.0f;
    float flow = 0.0f;
};
struct RelayCommand {
    uint8_t index = 0;
    bool open = false;
};

// Error codes. Values match the gaggimate.ErrorCode enum and the codes the old
// string protocol used, so existing firmware comparisons keep working.
constexpr int ERROR_CODE_NONE = 0;
constexpr int ERROR_CODE_COMM_SEND = 1;
constexpr int ERROR_CODE_COMM_RCV = 2;
constexpr int ERROR_CODE_PROTO_ERR = 3;
constexpr int ERROR_CODE_RUNAWAY = 4;
constexpr int ERROR_CODE_TIMEOUT = 5;
// Autotune hit its test-duration window without detecting a reaction. The
// controller skips the NVS PID persist; the display surfaces it without a
// watchdog-disconnect UX. Distinct from the generic TIMEOUT.
constexpr int ERROR_CODE_AUTOTUNE_TIMEOUT = 6;

#endif // GAGGIMATE_COMM_H
