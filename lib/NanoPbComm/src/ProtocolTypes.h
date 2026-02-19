#ifndef PROTOCOL_TYPES_H
#define PROTOCOL_TYPES_H

#include <Arduino.h>
#include <functional>
#include "gaggimate.pb.h"

// Error codes for communication and protocol errors
constexpr size_t ERROR_CODE_COMM_SEND = 1;
constexpr size_t ERROR_CODE_COMM_RCV = 2;
constexpr size_t ERROR_CODE_PROTO_ERR = 3;
constexpr size_t ERROR_CODE_RUNAWAY = 4;
constexpr size_t ERROR_CODE_TIMEOUT = 5;

// Nanopb message callback type
using nanopb_message_callback_t = std::function<void(const GaggiMessage& message)>;

// System capability flags
struct SystemCapabilities {
    bool dimming;
    bool pressure;
    bool ledControl;
    bool tof;
};

// Complete system information
struct SystemInfo {
    String hardware;
    String version;
    SystemCapabilities capabilities;
};

#endif // PROTOCOL_TYPES_H