#include "HomekitPlugin.h"
#include "../core/Controller.h"
#include "../core/constants.h"
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
    if (targetState->getVal() != targetState->getNewVal()) {
        state->setVal(targetState->getNewVal());
        this->callback();
    }
    if (targetTemperature->getVal() != targetTemperature->getNewVal()) {
        this->callback();
    }
    return true;
}

boolean HomekitAccessory::getState() const { return targetState->getVal() == 1; }

void HomekitAccessory::setState(bool active) const {
    this->targetState->setVal(active ? 1 : 0, true);
    this->state->setVal(active ? 1 : 0, true);
}

void HomekitAccessory::setCurrentTemperature(float temperatureValue) const { currentTemperature->setVal(temperatureValue, true); }

void HomekitAccessory::setTargetTemperature(float temperatureValue) const { targetTemperature->setVal(temperatureValue, true); }

float HomekitAccessory::getTargetTemperature() const { return targetTemperature->getVal(); }

HomekitPlugin::HomekitPlugin(String wifiSsid, String wifiPassword)
    : spanAccessory(nullptr), accessoryInformation(nullptr), identify(nullptr), accessory(nullptr), controller(nullptr) {
    this->wifiSsid = std::move(wifiSsid);
    this->wifiPassword = std::move(wifiPassword);
}

bool HomekitPlugin::hasAction() const { return actionRequired; }

void HomekitPlugin::clearAction() { actionRequired = false; }

void HomekitPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    pluginManager->on("controller:wifi:connect", [this](Event &event) {
        int apMode = event.getInt("AP");
        if (apMode)
            return;
        homeSpan.setHostNameSuffix("");
        homeSpan.setPortNum(HOMESPAN_PORT);
        homeSpan.begin(Category::Thermostats, DEVICE_NAME, this->controller->getSettings().getMdnsName().c_str());
        spanAccessory = new SpanAccessory();
        accessoryInformation = new Service::AccessoryInformation();
        identify = new Characteristic::Identify();
        accessory = new HomekitAccessory([this]() { this->actionRequired = true; });
        homeSpan.autoPoll();
    });

    pluginManager->on("boiler:targetTemperature:change", [this](Event const &event) {
        if (accessory == nullptr)
            return;
        accessory->setTargetTemperature(event.getInt("value"));
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
    if (!actionRequired || controller == nullptr || accessory == nullptr)
        return;
    if (accessory->getState() && controller->getMode() == MODE_STANDBY) {
        controller->deactivateStandby();
    } else if (!accessory->getState() && controller->getMode() != MODE_STANDBY) {
        controller->activateStandby();
    }
    controller->setTargetTemp(accessory->getTargetTemperature());
    actionRequired = false;
}
