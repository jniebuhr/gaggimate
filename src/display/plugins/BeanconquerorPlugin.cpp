#include "BeanconquerorPlugin.h"
#include "BLEScalePlugin.h"
#include "../core/Controller.h"
#include "../core/PluginManager.h"
#include <NimBLEDevice.h>
#include <cstring>

BeanconquerorPlugin::BeanconquerorPlugin() = default;

void BeanconquerorPlugin::setup(Controller *ctrl, PluginManager *manager) {
    controller = ctrl;
    pluginManager = manager;

    manager->on("controller:bluetooth:init", [this](Event const &) {
        initBLEServer();
    });

    manager->on("controller:brew:start", [this](Event const &) { brewing = true; });
    manager->on("controller:brew:prestart", [this](Event const &) { brewing = true; });
    manager->on("controller:brew:stop", [this](Event const &) { brewing = false; });
    manager->on("controller:mode:change", [this](Event const &event) {
        if (event.getInt("value") == 0) brewing = false;
    });
}

void BeanconquerorPlugin::initBLEServer() {
    // NimBLEDevice::init() was already called by NimBLEClientController.
    // Calling it again with "GaggiMate" updates the device name only.
    NimBLEDevice::init("GaggiMate");

    server = NimBLEDevice::createServer();

    NimBLEService *pService = server->createService(BC_SERVICE_UUID);

    shotDataChar = pService->createCharacteristic(
        BC_SHOT_DATA_CHAR_UUID,
        NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ
    );

    pService->start();

    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BC_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->start();

    bleReady = true;
    ESP_LOGI("BeanconquerorPlugin", "BLE peripheral ready, advertising as GaggiMate");
}

void BeanconquerorPlugin::loop() {
    if (!bleReady || shotDataChar == nullptr) return;
    if (shotDataChar->getSubscribedCount() == 0) return;

    const unsigned long interval = brewing ? BC_NOTIFY_INTERVAL_BREW_MS
                                           : BC_NOTIFY_INTERVAL_IDLE_MS;
    const unsigned long now = millis();
    if (now - lastNotify < interval) return;
    lastNotify = now;

    buildAndNotify();
}

void BeanconquerorPlugin::buildAndNotify() {
    // 28-byte payload (little-endian):
    //  [0]  uint32 timestamp_ms
    //  [4]  float  weight_g
    //  [8]  float  pressure_bar
    //  [12] float  temperature_c
    //  [16] float  pump_flow_ml_s
    //  [20] float  puck_flow_ml_s
    //  [24] uint8  flags (bit 0 = scale connected, bit 1 = brewing)
    //  [25-27] reserved

    uint8_t payload[28] = {};

    const uint32_t ts = static_cast<uint32_t>(millis());
    memcpy(payload + 0, &ts, 4);

    const float weight = BLEScales.getLastWeight();
    memcpy(payload + 4, &weight, 4);

    const float pressure = controller->getCurrentPressure();
    memcpy(payload + 8, &pressure, 4);

    const float temperature = controller->getCurrentTemp();
    memcpy(payload + 12, &temperature, 4);

    const float pumpFlow = controller->getCurrentPumpFlow();
    memcpy(payload + 16, &pumpFlow, 4);

    const float puckFlow = controller->getCurrentPuckFlow();
    memcpy(payload + 20, &puckFlow, 4);

    uint8_t flags = 0;
    if (BLEScales.isConnected()) flags |= 0x01;
    if (brewing)                  flags |= 0x02;
    payload[24] = flags;

    shotDataChar->setValue(payload, sizeof(payload));
    shotDataChar->notify();
}
