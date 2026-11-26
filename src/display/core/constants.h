
#ifndef CONSTANTS_H
#define CONSTANTS_H

constexpr int PING_INTERVAL = 2000; // keepalive ping cadence (ms); feeds the controller's connection watchdog
constexpr int PROGRESS_INTERVAL = 100;
constexpr int HOT_WATER_SAFETY_DURATION_MS = 120000;
constexpr int STEAM_SAFETY_DURATION_MS = 600000;
constexpr int BREW_MIN_DURATION_MS = 5000;
constexpr int BREW_MAX_DURATION_MS = 300000;
constexpr int BREW_SAFETY_DURATION_MS = BREW_MAX_DURATION_MS;
constexpr double BREW_MIN_VOLUMETRIC = 5.0;
constexpr int DEFAULT_FLUSH_DURATION_S = 5;
constexpr int MAX_FLUSH_DURATION_S = 60;
constexpr int FLUSH_HOLD_MAX_DURATION_S = 60; // safety cap for hold-to-flush (flush duration 0)
constexpr int FLUSH_DRAIN_DURATION_S = 1;     // valve stays open this long after the flush pump stops
constexpr double BREW_MAX_VOLUMETRIC = 250.0;
constexpr int DEFAULT_STANDBY_TIMEOUT_MS = 900000;
constexpr int MIN_TEMP = 0;
constexpr int MAX_TEMP = 160;
constexpr int DEFAULT_TEMPERATURE_OFFSET = 0;
constexpr float DEFAULT_PRESSURE_OFFSET = 0.0f;
// Flow-derived pressure offset. A spring-loaded mushroom valve's drop is a function of the flow
// through it, so a single constant is only correct at one flow rate. When enabled, the offset is
// interpolated from two measured (pressure, flow) points and capped at a third measured at 100%
// pump duty. Disabled by default; the constant offset above is used and behaviour is unchanged.
constexpr bool DEFAULT_PRESSURE_OFFSET_FLOW_DERIVED = false;
constexpr float DEFAULT_VALVE_CAL_P1 = 5.0f;   // suggested first calibration pressure (bar)
constexpr float DEFAULT_VALVE_CAL_F1 = 0.0f;   // measured flow there (g/s); 0 = not calibrated
constexpr float DEFAULT_VALVE_CAL_P2 = 6.0f;   // suggested second calibration pressure (bar)
constexpr float DEFAULT_VALVE_CAL_F2 = 0.0f;   // measured flow there (g/s); 0 = not calibrated
constexpr float DEFAULT_VALVE_CAL_PMAX = 0.0f; // pressure at 100% pump duty (bar); 0 = not calibrated
constexpr float DEFAULT_VALVE_CAL_FMAX = 0.0f; // flow at 100% pump duty (g/s); checked by the settings page
// Plausibility band for the derived slope, bar per g/s. Outside this the calibration is almost
// certainly a typo (e.g. two flows one digit apart) and is rejected on save.
constexpr float VALVE_CAL_MIN_SLOPE = 0.3f;
constexpr float VALVE_CAL_MAX_SLOPE = 2.0f;
constexpr float DEFAULT_PRESSURE_SCALING = 16.0f;
constexpr char DEFAULT_PID[] = "58.397,1.027,249.055,0.0";
constexpr int DEFAULT_HEATER_HANDOVER_MS = 50;
constexpr int MIN_HEATER_HANDOVER_MS = 20;
constexpr int MAX_HEATER_HANDOVER_MS = 5000;
constexpr char DEFAULT_PUMP_MODEL_COEFFS[] = "10.205,5.521";
constexpr char DEFAULT_PUMP_SLIP_COEFFS[] = "0,0,0,0";
constexpr char DEFAULT_MDNS_NAME[] = "gaggimate";
constexpr char DEFAULT_OTA_CHANNEL[] = "latest";
constexpr char DEFAULT_TIMEZONE[] = "Europe/Rome";
constexpr char DEFAULT_HOME_ASSISTANT_TOPIC[] = "homeassistant";
constexpr float DEFAULT_STEAM_PUMP_PERCENTAGE = 4.f;
constexpr float DEFAULT_STEAM_PUMP_CUTOFF = 2.f;
constexpr int WIFI_CONNECT_ATTEMPTS = 20;

constexpr float DEFAULT_COMMUTATION_GAIN = 0.7f;
constexpr float DEFAULT_CONVERGENCE_GAIN = 1.0f;
constexpr float DEFAULT_INTEGRAL_GAIN = 0.25f;

constexpr int MODE_STANDBY = 0;
constexpr int MODE_BREW = 1;
constexpr int MODE_STEAM = 2;
constexpr int MODE_WATER = 3;
constexpr int MODE_GRIND = 4;

// Alt Relay / SSR2 Function constants
constexpr int ALT_RELAY_NONE = 0;
constexpr int ALT_RELAY_GRIND = 1;
constexpr int ALT_RELAY_STEAM_BOILER = 2;

constexpr int WIFI_CONNECT_TIMEOUT_MS = 30000;
constexpr int DEFAULT_WIFI_AP_TIMEOUT_MS = 600000;
constexpr int DEFAULT_WIFI_AP_PASSWORD_LENGTH = 10; // generated AP password length (alphanumeric)
constexpr int WIFI_AP_PASSWORD_MIN_LENGTH = 8;      // WPA2 minimum passphrase length

#endif // CONSTANTS_H
