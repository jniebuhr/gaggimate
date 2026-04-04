#include "HomekitPlugin.h"
#include "../core/Controller.h"
#include "../core/constants.h"
#include "../../version.h"
#include <cmath>
#include <utility>

HomekitAccessory::HomekitAccessory(change_callback_t callback)
    : callback(nullptr), state(nullptr), targetState(nullptr), currentTemperature(nullptr), targetTemperature(nullptr),
      displayUnits(nullptr) {
    this->callback = std::move(callback);
    state = new Characteristic::CurrentHeatingCoolingState();
    targetState = new Characteristic::TargetHeatingCoolingState();
    targetState->setValidValues(2, 0, 1);
    currentTemperature = new Characteristic::CurrentTemperature();
    currentTemperature->setRange(0, 160);
    targetTemperature = new Characteristic::TargetTemperature();
    targetTemperature->setRange(0, 160);
    displayUnits = new Characteristic::TemperatureDisplayUnits();
    displayUnits->setVal(0);
}

boolean HomekitAccessory::update() {
    const bool stateChanged = targetState->updated() && targetState->getVal() != targetState->getNewVal();
    const bool temperatureChanged =
        targetTemperature->updated() &&
        std::fabs(targetTemperature->getVal<float>() - targetTemperature->getNewVal<float>()) > 0.01f;

    if (stateChanged) {
        state->setVal(targetState->getNewVal(), true);
    }

    if (stateChanged || temperatureChanged) {
        this->callback(stateChanged, temperatureChanged);
    }

    return true;
}

boolean HomekitAccessory::getState() const { return targetState->getVal() == 1; }

void HomekitAccessory::setState(bool active) const {
    this->targetState->setVal(active ? 1 : 0, true);
    this->state->setVal(active ? 1 : 0, true);
}

void HomekitAccessory::setCurrentTemperature(float temperatureValue) const { currentTemperature->setVal(temperatureValue, true); }

void HomekitAccessory::setTargetTemperature(float temperatureValue) const {
    targetTemperature->setVal(constrain(temperatureValue, static_cast<float>(MIN_TEMP), static_cast<float>(MAX_TEMP)), true);
}

float HomekitAccessory::getTargetTemperature() const {
    return constrain(targetTemperature->getVal<float>(), static_cast<float>(MIN_TEMP), static_cast<float>(MAX_TEMP));
}

HomekitPlugin::HomekitPlugin(String wifiSsid, String wifiPassword)
    : spanAccessory(nullptr), accessoryInformation(nullptr), identify(nullptr), accessory(nullptr), controller(nullptr) {
    this->wifiSsid = std::move(wifiSsid);
    this->wifiPassword = std::move(wifiPassword);
}

bool HomekitPlugin::hasStateAction() const { return stateActionRequired; }

bool HomekitPlugin::hasTemperatureAction() const { return temperatureActionRequired; }

void HomekitPlugin::clearStateAction() { stateActionRequired = false; }

void HomekitPlugin::clearTemperatureAction() { temperatureActionRequired = false; }

String HomekitPlugin::getSerialNumber() const {
    const uint64_t chipId = ESP.getEfuseMac();
    char serial[17];
    snprintf(serial, sizeof(serial), "%04X%08X", static_cast<uint16_t>(chipId >> 32), static_cast<uint32_t>(chipId));
    return String(serial);
}

void HomekitPlugin::syncAccessoryState() const {
    if (accessory == nullptr || controller == nullptr) {
        return;
    }

    accessory->setState(controller->getMode() != MODE_STANDBY);
    accessory->setCurrentTemperature(controller->getCurrentTemp());
    accessory->setTargetTemperature(controller->getTargetTemp());
}

void HomekitPlugin::initializeHomekit() {
    if (homekitInitialized || controller == nullptr) {
        return;
    }

    homeSpan.setHostNameSuffix("");
    homeSpan.setPortNum(HOMESPAN_PORT);
    homeSpan.setWifiCredentials(wifiSsid.c_str(), wifiPassword.c_str());
    homeSpan.begin(Category::Thermostats, DEVICE_NAME, this->controller->getSettings().getMdnsName().c_str());

    spanAccessory = new SpanAccessory();
    accessoryInformation = new Service::AccessoryInformation();
    new Characteristic::Manufacturer(HOMEKIT_MANUFACTURER);
    new Characteristic::Model(HOMEKIT_MODEL);
    new Characteristic::SerialNumber(getSerialNumber().c_str());
    new Characteristic::FirmwareRevision(BUILD_GIT_VERSION);
    identify = new Characteristic::Identify();
    accessory = new HomekitAccessory([this](const bool stateChanged, const bool temperatureChanged) {
        this->stateActionRequired = this->stateActionRequired || stateChanged;
        this->temperatureActionRequired = this->temperatureActionRequired || temperatureChanged;
    });

    syncAccessoryState();
    homeSpan.autoPoll();
    homekitInitialized = true;
}

void HomekitPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    pluginManager->on("controller:wifi:connect", [this](Event &event) {
        if (event.getInt("AP"))
            return;

        if (!homekitInitialized) {
            initializeHomekit();
            return;
        }

        syncAccessoryState();
    });

    pluginManager->on("boiler:targetTemperature:change", [this](Event const &event) {
        if (accessory == nullptr)
            return;
        accessory->setTargetTemperature(event.getFloat("value"));
    });

    pluginManager->on("boiler:currentTemperature:change", [this](Event const &event) {
        if (accessory == nullptr)
            return;
        accessory->setCurrentTemperature(event.getFloat("value"));
    });

    pluginManager->on("controller:mode:change", [this](Event const &event) {
        if (accessory == nullptr)
            return;
        accessory->setState(event.getInt("value") != MODE_STANDBY);
    });
}

void HomekitPlugin::loop() {
    if (controller == nullptr || accessory == nullptr)
        return;

    if (stateActionRequired && accessory->getState() && controller->getMode() == MODE_STANDBY) {
        controller->deactivateStandby();
    } else if (stateActionRequired && !accessory->getState() && controller->getMode() != MODE_STANDBY) {
        controller->activateStandby();
    }
    clearStateAction();

    if (temperatureActionRequired) {
        const float requestedTemperature = accessory->getTargetTemperature();
        if (std::fabs(controller->getTargetTemp() - requestedTemperature) > 0.05f) {
            controller->setTargetTemp(requestedTemperature);
        }
        clearTemperatureAction();
    }
}
