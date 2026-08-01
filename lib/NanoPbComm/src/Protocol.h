#ifndef NANOPBCOMM_PROTOCOL_H
#define NANOPBCOMM_PROTOCOL_H

#include "Messages.h"
#include <cstdint>

// Shared protocol UUIDs and helpers used by both ends.
namespace gm_proto {

// BLE service + characteristics. A single TX/RX pair carries framed nanopb
// datagrams (replacing the old one-characteristic-per-message design). The
// service UUID is kept so the display scan logic is unchanged.
static constexpr const char *SERVICE_UUID = "e75bc5b6-ff6e-4337-9d31-0c128f2e6e68";
// Controller (server) -> display (client) notifications.
static constexpr const char *TX_CHAR_UUID = "87654321-4321-8765-4321-cba987654321";
// Display (client) -> controller (server) writes.
static constexpr const char *RX_CHAR_UUID = "12345678-1234-5678-1234-123456789abc";
// Legacy read-only system-info characteristic (JSON), kept for external readers.
static constexpr const char *INFO_CHAR_UUID = "f8d7203b-e00c-48e2-83ba-37ff49cdba74";

// Protocol/schema version. Bump on any breaking change to gaggimate.proto so a
// display talking to an out-of-date controller (or vice versa) can detect the
// mismatch. Carried in SystemInfo.protocol_version.
static constexpr uint32_t PROTOCOL_VERSION = 3;

// Outbound priorities (higher wins in the queue).
enum Priority : uint8_t {
    PRIO_LOW = 50,      // telemetry: sensor / volumetric / tof
    PRIO_NORMAL = 100,  // settings, system info, tare, led, autotune
    PRIO_CONTROL = 150, // boiler / pump / valve / alt output control
    PRIO_HIGH = 200,    // ping, error
};

// Per-family device-index space for the coalescing key. Keeps keys dense so the
// queue's reverse-lookup table stays small.
static constexpr uint16_t MAX_DEVICES = 8;

// Coalescing key: a (message family, device index) pair so repeated updates for
// the same component collapse to the latest value. Device-less messages map to
// index 0. Keys stay below which_content_max * MAX_DEVICES.
inline uint16_t coalescingKey(const gm::Payload &p) {
    uint16_t index = 0;
    switch (p.which_content) {
    case gaggimate_Payload_boiler_tag:
        index = p.content.boiler.index;
        break;
    case gaggimate_Payload_pump_tag:
        index = p.content.pump.index;
        break;
    case gaggimate_Payload_relay_tag:
        index = p.content.relay.index;
        break;
    case gaggimate_Payload_button_tag:
        index = p.content.button.index;
        break;
    default:
        index = 0;
        break;
    }
    if (index >= MAX_DEVICES)
        index = MAX_DEVICES - 1;
    return static_cast<uint16_t>(p.which_content) * MAX_DEVICES + index;
}

inline uint8_t defaultPriority(pb_size_t which) {
    switch (which) {
    case gaggimate_Payload_ping_tag:
    case gaggimate_Payload_error_tag:
        return PRIO_HIGH;
    case gaggimate_Payload_boiler_tag:
    case gaggimate_Payload_pump_tag:
    case gaggimate_Payload_relay_tag:
        return PRIO_CONTROL;
    case gaggimate_Payload_sensor_tag:
    case gaggimate_Payload_volumetric_tag:
    case gaggimate_Payload_tof_tag:
        return PRIO_LOW;
    default:
        return PRIO_NORMAL;
    }
}

} // namespace gm_proto

#endif // NANOPBCOMM_PROTOCOL_H
