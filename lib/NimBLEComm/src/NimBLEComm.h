#ifndef NIMBLECOMM_H
#define NIMBLECOMM_H

#include <Arduino.h>
#include <NimBLEDevice.h>

// UUIDs for BLE services and characteristics
#define SERVICE_UUID "e75bc5b6-ff6e-4337-9d31-0c128f2e6e68"
#define ALT_CONTROL_CHAR_UUID "cca5a577-ec67-4499-8ccb-654f1312db1d"
#define PING_CHAR_UUID "9731755e-29ce-41a8-91d9-7a244f49859b"
#define ERROR_CHAR_UUID "d6676ec7-820c-41de-820d-95620749003b"
#define AUTOTUNE_CHAR_UUID "d54df381-69b6-4531-b1cc-dde7766bbaf4"
#define AUTOTUNE_RESULT_UUID "7f61607a-2817-4354-9b94-d49c057fc879"
#define PID_CONTROL_CHAR_UUID "d448c469-3e1d-4105-b5b8-75bf7d492fad"
#define PUMP_MODEL_COEFFS_CHAR_UUID "e448c469-3e1d-4105-b5b8-75bf7d492fae"
#define INFO_UUID "f8d7203b-e00c-48e2-83ba-37ff49cdba74"
#define BTN_UUID "d38a5efc-189e-4199-8105-1d94b94253fc"

#define PRESSURE_SCALE_UUID "3aa65ab6-2dda-4c95-9cf3-58b2a0480623"
#define SENSOR_DATA_UUID "62b69e72-ac19-4d4b-bd53-2edd65330c93"
#define OUTPUT_CONTROL_UUID "77fbb08f-c29c-4f2e-8e1d-ed0a9afa5e1a"
#define VOLUMETRIC_MEASUREMENT_UUID "b0080557-3865-4a9c-be37-492d77ee5951"
#define VOLUMETRIC_TARE_UUID "a8bd52e0-77c3-412c-847c-4e802c3982f9"
#define TOF_MEASUREMENT_UUID "7282c525-21a0-416a-880d-21fe98602533"
#define LED_CONTROL_UUID "37804a2b-49ab-4500-8582-db4279fc8573"

constexpr size_t ERROR_CODE_NONE = 0;
constexpr size_t ERROR_CODE_COMM_SEND = 1;
constexpr size_t ERROR_CODE_COMM_RCV = 2;
constexpr size_t ERROR_CODE_PROTO_ERR = 3;
constexpr size_t ERROR_CODE_RUNAWAY = 4;
constexpr size_t ERROR_CODE_TIMEOUT = 5;
// Autotune hit test-duration window without detecting reaction/inflection.
// Controller skips NVS persist on this fire — display PID preserved. Distinct
// from generic TIMEOUT so display UI can surface it without watchdog-
// disconnect UX.
constexpr size_t ERROR_CODE_AUTOTUNE_TIMEOUT = 6;

using pin_control_callback_t = std::function<void(bool isActive)>;
using pid_control_callback_t = std::function<void(float Kp, float Ki, float Kd, float Kf)>;
using pump_model_coeffs_callback_t = std::function<void(float a, float b, float c, float d)>;
using ping_callback_t = std::function<void()>;
using remote_err_callback_t = std::function<void(int errorCode)>;
// heaterWattage in W; 0 = unknown (controller skips combinedKff derivation).
// Optional 3rd field on AUTOTUNE_CHAR_UUID payload — older display firmware
// sends only "testTime,samples" and the parser defaults wattage to 0.
using autotune_callback_t = std::function<void(int testTime, int samples, int heaterWattage)>;
using void_callback_t = std::function<void()>;

// New combined callbacks
using float_callback_t = std::function<void(float val)>;
using int_callback_t = std::function<void(int val)>;
using button_callback_t = std::function<void(uint8_t index, bool val)>;
using simple_output_callback_t = std::function<void(bool valve, float pumpSetpoint, float boilerSetpoint)>;
using advanced_output_callback_t =
    std::function<void(bool valve, float boilerSetpoint, bool pressureTarget, float pumpPressure, float pumpFlow)>;
using sensor_read_callback_t =
    std::function<void(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance)>;
using led_control_callback_t = std::function<void(uint8_t channel, uint8_t brightness)>;

struct SystemCapabilities {
    bool dimming;
    bool pressure;
    bool ledControl;
    bool tof;
};

struct SystemInfo {
    String hardware;
    String version;
    SystemCapabilities capabilities;
};

String get_token(const String &from, uint8_t index, char separator, String default_value = "");

#endif // NIMBLECOMM_H
