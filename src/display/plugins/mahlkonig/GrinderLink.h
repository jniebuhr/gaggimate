#ifndef MAHLKONIG_GRINDERLINK_H
#define MAHLKONIG_GRINDERLINK_H

#include <cstdint>

// Wire contract between an E64 WS in Grind-by-Sync mode and GaggiMate, which plays its espresso machine
namespace gbs {

// Routes the grinder calls on GaggiMate's web server
constexpr const char *ROUTE_IDENTITY = "/api/v2/machine";
constexpr const char *ROUTE_STATUS = "/api/v2/mako";
constexpr const char *ROUTE_GRIND_DONE = "/api/v2/brewratio";
constexpr const char *ROUTE_RUN_SCRIPT = "/api/v2/scripts/execute";
constexpr const char *ROUTE_FAMILY = "/api/v2/";

// Script the grinder asks for when the user presses its knob to brew
constexpr int GRINDER_START_SCRIPT = 9;

// Machine state as reported in MA_STATUS
enum class MachineState : uint8_t {
    Standby = 0,
    Ready = 1,
    Brewing = 3,
    ShotDone = 4,
    Service = 5,
    Error = 6,
};

// Shot state as reported in MA_EXTRACTION_STATUS
constexpr int SHOT_IDLE = 0;
constexpr int SHOT_ACTIVE = 1;

// TANK_LEVEL: only WATER_OK lets the grinder grind
constexpr int WATER_OK = 1;
constexpr int WATER_EMPTY = 0;

// Machine type and firmware versions the grinder checks before syncing
constexpr int XENIA_TYPE = 1;
constexpr int XENIA_FW_MAJOR = 4;
constexpr int XENIA_FW_MINOR = 226;
constexpr int XENIA_ESP_MAJOR = 3;
constexpr int XENIA_ESP_MINOR = 87;

// The only fields of the grind-done report (seen on a real E64 WS); it carries no dose, so doses are set per recipe
constexpr const char *FIELD_TARGET_WEIGHT = "SYNC_BEVERAGE_WEIGHT";
constexpr const char *FIELD_RECIPE = "SYNC_FILTER"; // recipe slot on the grinder

// Long enough for two grinder polls to see the finished shot
constexpr unsigned long SHOT_DONE_VISIBLE_MS = 5000;

} // namespace gbs

#endif // MAHLKONIG_GRINDERLINK_H
