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
void BLEScalePlugin::scan() const {}
void BLEScalePlugin::disconnect() {}
void BLEScalePlugin::onMeasurement(float) const {}
std::vector<DiscoveredDevice> BLEScalePlugin::getDiscoveredScales() const { return {}; }
void BLEScalePlugin::tare() const {}
void BLEScalePlugin::update() {}
void BLEScalePlugin::onProcessStart() const {}
void BLEScalePlugin::pollScaleMetadata() {}
void BLEScalePlugin::establishConnection() {}
