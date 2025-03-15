#include "BLEScalePlugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <display/core/Controller.h>
#include <scales/acaia.h>
#include <scales/bookoo.h>
#include <scales/decent.h>
#include <scales/difluid.h>
#include <scales/eclair.h>
#include <scales/eureka.h>
#include <scales/felicitaScale.h>
#include <scales/timemore.h>
#include <scales/varia.h>

void on_ble_measurement(float value) { BLEScales.onMeasurement(value); }

BLEScalePlugin BLEScales;

BLEScalePlugin::BLEScalePlugin() = default;

void BLEScalePlugin::setup(Controller *controller, PluginManager *manager) {
    this->controller = controller;
    this->pluginRegistry = RemoteScalesPluginRegistry::getInstance();
    AcaiaScalesPlugin::apply();
    BookooScalesPlugin::apply();
    DecentScalesPlugin::apply();
    DifluidScalesPlugin::apply();
    EclairScalesPlugin::apply();
    EurekaScalesPlugin::apply();
    FelicitaScalePlugin::apply();
    TimemoreScalesPlugin::apply();
    VariaScalesPlugin::apply();
    this->scanner = new RemoteScalesScanner();
    manager->on("controller:brew:start", [this](Event const &) { onProcessStart(); });
    manager->on("controller:grind:start", [this](Event const &) { onProcessStart(); });
    manager->on("controller:bluetooth:connect", [this](Event const &) { scanner->initializeAsyncScan(); });
    manager->on("controller:mode:change", [this](Event const &event) {
        if (event.getInt("value") != MODE_STANDBY) {
            scan();
        } else {
            scanner->stopAsyncScan();
        }
    });
}

void BLEScalePlugin::loop() {
    if (doConnect && scale == nullptr) {
        establishConnection();
    }
    const unsigned long now = millis();
    if (now - lastUpdate > UPDATE_INTERVAL_MS) {
        lastUpdate = now;
        update();
    }
}

void BLEScalePlugin::update() {
    controller->setVolumetricAvailable(scale && scale->isConnected());
    if (scale != nullptr) {
        scale->update();
        if (!scale->isConnected()) {
            reconnectionTries++;
            if (reconnectionTries > RECONNECTION_TRIES) {
                disconnect();
            }
        }
    } else if (controller->getSettings().getSavedScale() != "") {
        for (const auto &d : scanner->getDiscoveredScales()) {
            if (d.getAddress().toString() == controller->getSettings().getSavedScale().c_str()) {
                connect(d.getAddress().toString());
            }
        }
    }
}

void BLEScalePlugin::connect(const std::string &uuid) {
    doConnect = true;
    this->uuid = uuid;
    controller->getSettings().setSavedScale(uuid.data());
}

void BLEScalePlugin::scan() const {
    if (scale != nullptr && scale->isConnected()) {
        return;
    }
    scanner->initializeAsyncScan();
}

void BLEScalePlugin::disconnect() {
    if (scale != nullptr) {
        scale->disconnect();
        scale = nullptr;
        scanner->initializeAsyncScan();
    }
}

void BLEScalePlugin::onProcessStart() const {
    if (scale != nullptr && scale->isConnected()) {
        scale->tare();
    }
}

void BLEScalePlugin::establishConnection() {
    scanner->stopAsyncScan();
    for (const auto &d : scanner->getDiscoveredScales()) {
        if (d.getAddress().toString() == uuid) {
            reconnectionTries = 0;
            scale = RemoteScalesFactory::getInstance()->create(d);
            if (!scale) {
                printf("Connection to device %s failed\n", d.getName().c_str());
                return;
            }

            scale->setLogCallback([](std::string message) { Serial.print(message.c_str()); });

            scale->setWeightUpdatedCallback([](float weight) { BLEScales.onMeasurement(weight); });

            if (!scale->connect()) {
                disconnect();
            }
            break;
        }
    }
}

void BLEScalePlugin::onMeasurement(float value) const {
    if (controller != nullptr) {
        controller->onVolumetricMeasurement(value);
    }
}

std::vector<DiscoveredDevice> BLEScalePlugin::getDiscoveredScales() const { return scanner->getDiscoveredScales(); }
