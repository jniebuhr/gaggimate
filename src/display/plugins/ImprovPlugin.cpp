#include "ImprovPlugin.h"

#include <ImprovWiFiLibrary.h>
#include <display/core/Controller.h>
#include <version.h>

static ImprovPlugin *instance = nullptr;

static ImprovTypes::ChipFamily currentChipFamily() { return ImprovTypes::CF_ESP32_S3; }

void ImprovPlugin::setup(Controller *_controller, PluginManager *pluginManager) {
    controller = _controller;
    instance = this;

    Settings &settings = controller->getSettings();
    firmwareVersion = BUILD_GIT_VERSION;
    deviceName = settings.getMdnsName();
    deviceUrl = "http://" + settings.getMdnsName() + ".local/";

    improv = new ImprovWiFi(&Serial);
    improv->setDeviceInfo(currentChipFamily(), "GaggiMate", firmwareVersion.c_str(), deviceName.c_str(), deviceUrl.c_str());
    improv->setCustomConnectWiFi(onConnectWifi);
    improv->onImprovConnected(onConnected);
}

void ImprovPlugin::loop() {
    if (improv == nullptr) {
        return;
    }
    // The library reads one byte per handleSerial() call; drain the RX buffer
    // each pass so a multi-byte command isn't dribbled out over many 50ms loops.
    while (!rebootPending && Serial.available() > 0) {
        improv->handleSerial();
    }
    if (rebootPending) {
        Serial.flush(); // let the Improv success/device-URL response drain first
        delay(200);
        ESP.restart();
    }
}

bool ImprovPlugin::onConnectWifi(const char *ssid, const char *password) {
    if (instance == nullptr || instance->controller == nullptr) {
        return false;
    }
    // Save and report success without connecting; setupWifi() connects on reboot.
    Settings &settings = instance->controller->getSettings();
    settings.setWifiSsid(String(ssid));
    settings.setWifiPassword(String(password));
    settings.save(true); // synchronous persist before the reboot
    ESP_LOGI("ImprovPlugin", "Stored Wi-Fi credentials for '%s' via Improv, rebooting", ssid);
    return true;
}

void ImprovPlugin::onConnected(const char *ssid, const char *password) {
    if (instance != nullptr) {
        instance->rebootPending = true;
    }
}
