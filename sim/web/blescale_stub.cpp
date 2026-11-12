// Sim stub for BLEScalePlugin: the real plugin (NimBLE) is excluded, but the
// global BLEScales instance and its out-of-line methods are still referenced by
// WebUIPlugin and the generated ui_events. All methods are no-ops here.
#include <display/plugins/BLEScalePlugin.h>

BLEScalePlugin BLEScales;

void on_ble_measurement(float) {}

BLEScalePlugin::BLEScalePlugin() {}
BLEScalePlugin::~BLEScalePlugin() {}
void BLEScalePlugin::setup(Controller *, PluginManager *) {}
void BLEScalePlugin::loop() {}
void BLEScalePlugin::connect(const std::string &) {}
void BLEScalePlugin::scan() {}
void BLEScalePlugin::forget() {}
void BLEScalePlugin::disconnect() {}
void BLEScalePlugin::onMeasurement(float) {}
std::vector<DiscoveredDevice> BLEScalePlugin::getDiscoveredScales() const { return {}; }
// The simulated Bluetooth scale (sim/driver/SdlDriver.h) zeroes on the firmware's tare requests.
extern float g_simScaleTarget;
extern float g_simScaleOffset;
void BLEScalePlugin::tare() const {
    if (g_simScaleTarget >= 0.0f)
        g_simScaleOffset = g_simScaleTarget;
}
void BLEScalePlugin::update() {}
void BLEScalePlugin::onProcessStart() const { tare(); }
void BLEScalePlugin::pollScaleMetadata() {}
void BLEScalePlugin::establishConnection() {}
void BLEScalePlugin::emitScanComplete() {}
void BLEScalePlugin::emitConnectError(const std::string &, const char *) {}
