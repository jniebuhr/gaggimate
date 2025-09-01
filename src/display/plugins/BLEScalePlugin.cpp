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
#include <scales/myscale.h>
#include <scales/timemore.h>
#include <scales/varia.h>
#include <scales/weighmybru.h>

void on_ble_measurement(float value) { 
    if (&BLEScales != nullptr) {
        BLEScales.onMeasurement(value); 
    }
}

BLEScalePlugin BLEScales;

BLEScalePlugin::BLEScalePlugin() = default;

BLEScalePlugin::~BLEScalePlugin() {
    // Ensure proper cleanup
    disconnect();
    if (scanner != nullptr) {
        scanner->stopAsyncScan();
        delete scanner;
        scanner = nullptr;
    }
}

void BLEScalePlugin::setup(Controller *controller, PluginManager *manager) {
    if (controller == nullptr || manager == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Invalid controller or manager passed to setup");
        return;
    }
    
    this->controller = controller;
    this->pluginRegistry = RemoteScalesPluginRegistry::getInstance();
    
    // Apply scale plugins with error checking
    AcaiaScalesPlugin::apply();
    BookooScalesPlugin::apply();
    DecentScalesPlugin::apply();
    DifluidScalesPlugin::apply();
    EclairScalesPlugin::apply();
    EurekaScalesPlugin::apply();
    FelicitaScalePlugin::apply();
    TimemoreScalesPlugin::apply();
    VariaScalesPlugin::apply();
    WeighMyBrewScalePlugin::apply();
    myscalePlugin::apply();
    
    // Initialize scanner with error handling
    this->scanner = new(std::nothrow) RemoteScalesScanner();
    if (this->scanner == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Failed to create RemoteScalesScanner - out of memory");
        return;
    }
    
    manager->on("controller:ready", [this](Event const &) {
        if (this->controller != nullptr && this->controller->getMode() != MODE_STANDBY) {
            ESP_LOGI("BLEScalePlugin", "Resuming scanning");
            scan();
            active = true;
        }
    });
    manager->on("controller:brew:prestart", [this](Event const &) { onProcessStart(); });
    manager->on("controller:grind:start", [this](Event const &) { onProcessStart(); });
    manager->on("controller:mode:change", [this](Event const &event) {
        if (event.getInt("value") != MODE_STANDBY) {
            ESP_LOGI("BLEScalePlugin", "Resuming scanning");
            scan();
            active = true;
        } else {
            active = false;
            disconnect();
            if (scanner != nullptr) {
                scanner->stopAsyncScan();
            }
            ESP_LOGI("BLEScalePlugin", "Stopping scanning, disconnecting");
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
    if (controller == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Controller is null in update()");
        return;
    }
    
    controller->setVolumetricOverride(scale != nullptr && scale->isConnected());
    if (!active)
        return;
    if (scale != nullptr) {
        scale->update();
        if (!scale->isConnected()) {
            reconnectionTries++;
            if (reconnectionTries > RECONNECTION_TRIES) {
                disconnect();
                if (scanner != nullptr) {
                    this->scanner->initializeAsyncScan();
                }
            }
        }
    } else if (controller->getSettings().getSavedScale() != "" && scanner != nullptr) {
        auto discoveredScales = scanner->getDiscoveredScales();
        for (const auto &d : discoveredScales) {
            if (d.getAddress().toString() == controller->getSettings().getSavedScale().c_str()) {
                ESP_LOGI("BLEScalePlugin", "Connecting to last known scale");
                connect(d.getAddress().toString());
                break;
            }
        }
    }
}

void BLEScalePlugin::connect(const std::string &uuid) {
    if (uuid.empty()) {
        ESP_LOGE("BLEScalePlugin", "Cannot connect with empty UUID");
        return;
    }
    if (controller == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Controller is null, cannot save scale setting");
        return;
    }
    
    doConnect = true;
    this->uuid = uuid;
    controller->getSettings().setSavedScale(uuid.data());
}

void BLEScalePlugin::scan() const {
    if (scale != nullptr && scale->isConnected()) {
        return;
    }
    if (scanner == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Scanner not initialized, cannot start scan");
        return;
    }
    scanner->initializeAsyncScan();
}

void BLEScalePlugin::disconnect() {
    if (scale != nullptr) {
        // Add small delay to let any pending callbacks complete
        delay(50);
        scale->disconnect();
        scale = nullptr;
        uuid = "";
        doConnect = false;
        reconnectionTries = 0;
    }
}

void BLEScalePlugin::onProcessStart() const {
    if (scale != nullptr && scale->isConnected()) {
        scale->tare();
        delay(50);
        scale->tare();
    }
}

void BLEScalePlugin::establishConnection() {
    if (uuid.empty()) {
        ESP_LOGE("BLEScalePlugin", "Cannot establish connection with empty UUID");
        return;
    }
    
    ESP_LOGI("BLEScalePlugin", "Connecting to %s", uuid.c_str());
    if (scanner == nullptr) {
        ESP_LOGE("BLEScalePlugin", "Scanner not initialized, cannot establish connection");
        return;
    }
    
    scanner->stopAsyncScan();
    
    auto discoveredScales = scanner->getDiscoveredScales();
    bool deviceFound = false;
    
    for (const auto &d : discoveredScales) {
        if (d.getAddress().toString() == uuid) {
            deviceFound = true;
            reconnectionTries = 0;
            
            auto factory = RemoteScalesFactory::getInstance();
            if (factory == nullptr) {
                ESP_LOGE("BLEScalePlugin", "RemoteScalesFactory instance is null");
                return;
            }
            
            scale = factory->create(d);
            if (!scale) {
                ESP_LOGE("BLEScalePlugin", "Connection to device %s failed\n", d.getName().c_str());
                return;
            }

            scale->setLogCallback([](std::string message) { 
                if (!message.empty()) {
                    Serial.print(message.c_str()); 
                }
            });

            scale->setWeightUpdatedCallback([](float weight) { 
                // Add a safety check before calling onMeasurement
                if (&BLEScales != nullptr) {
                    BLEScales.onMeasurement(weight); 
                }
            });

            if (!scale->connect()) {
                ESP_LOGW("BLEScalePlugin", "Failed to connect to scale, retrying scan");
                disconnect();
                if (scanner != nullptr) {
                    this->scanner->initializeAsyncScan();
                }
            }
            break;
        }
    }
    
    if (!deviceFound) {
        ESP_LOGW("BLEScalePlugin", "Device %s not found in discovered scales", uuid.c_str());
        if (scanner != nullptr) {
            this->scanner->initializeAsyncScan();
        }
    }
}

void BLEScalePlugin::onMeasurement(float value) const {
    if (controller != nullptr) {
        controller->onVolumetricMeasurement(value, VolumetricMeasurementSource::BLUETOOTH);
    }
}

std::vector<DiscoveredDevice> BLEScalePlugin::getDiscoveredScales() const { 
    if (scanner == nullptr) {
        ESP_LOGW("BLEScalePlugin", "Scanner not initialized, returning empty device list");
        return std::vector<DiscoveredDevice>();
    }
    return scanner->getDiscoveredScales(); 
}
