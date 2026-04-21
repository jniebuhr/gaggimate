#include "HomekitPlugin.h"
// HomeSpan 2.x defines `class Controller` at global scope — rename it via the
// preprocessor so it doesn't collide with our own Controller (used everywhere).
#define Controller HomeSpan_Controller
#include <HomeSpan.h>
#undef Controller
#include "../core/Controller.h"
#include "../core/Event.h"
#include "../core/PluginManager.h"
#include "../core/constants.h"
#include <utility>

namespace {

constexpr uint16_t kHomeSpanPort = 8080;
constexpr const char *kDeviceName = "GaggiMate";

using ChangeCallback = std::function<void()>;

class HomekitAccessory : public Service::Thermostat {
  public:
    explicit HomekitAccessory(ChangeCallback cb) : callback(std::move(cb)) {
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

    boolean update() override {
        if (targetState->getVal() != targetState->getNewVal()) {
            state->setVal(targetState->getNewVal());
            callback();
        }
        if (targetTemperature->getVal() != targetTemperature->getNewVal()) {
            callback();
        }
        return true;
    }

    bool getState() const { return targetState->getVal() == 1; }

    void setState(bool active) const {
        targetState->setVal(active ? 1 : 0, true);
        state->setVal(active ? 1 : 0, true);
    }

    void setCurrentTemperature(float v) const { currentTemperature->setVal(v, true); }
    void setTargetTemperature(float v) const { targetTemperature->setVal(v, true); }
    float getTargetTemperature() const { return targetTemperature->getVal(); }

  private:
    ChangeCallback callback;
    SpanCharacteristic *state = nullptr;
    SpanCharacteristic *targetState = nullptr;
    SpanCharacteristic *currentTemperature = nullptr;
    SpanCharacteristic *targetTemperature = nullptr;
    SpanCharacteristic *displayUnits = nullptr;
};

} // namespace

struct HomekitPlugin::Impl {
    String wifiSsid;
    String wifiPassword;
    SpanAccessory *spanAccessory = nullptr;
    Service::AccessoryInformation *accessoryInformation = nullptr;
    Characteristic::Identify *identify = nullptr;
    HomekitAccessory *accessory = nullptr;
    ::Controller *controller = nullptr; // qualify: HomeSpan also declares ::Controller
    bool actionRequired = false;
};

HomekitPlugin::HomekitPlugin(String wifiSsid, String wifiPassword) : impl(std::make_unique<Impl>()) {
    impl->wifiSsid = std::move(wifiSsid);
    impl->wifiPassword = std::move(wifiPassword);
}

HomekitPlugin::~HomekitPlugin() = default;

bool HomekitPlugin::hasAction() const { return impl->actionRequired; }

void HomekitPlugin::clearAction() { impl->actionRequired = false; }

void HomekitPlugin::setup(::Controller *controller, PluginManager *pluginManager) {
    impl->controller = controller;

    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        int apMode = event.getInt("AP");
        if (apMode)
            return;
        homeSpan.setHostNameSuffix("");
        homeSpan.setPortNum(kHomeSpanPort);
        homeSpan.begin(Category::Thermostats, kDeviceName, impl->controller->getSettings().getMdnsName().c_str());
        homeSpan.setWifiCredentials(impl->wifiSsid.c_str(), impl->wifiPassword.c_str());
        impl->spanAccessory = new SpanAccessory();
        impl->accessoryInformation = new Service::AccessoryInformation();
        impl->identify = new Characteristic::Identify();
        impl->accessory = new HomekitAccessory([this]() { impl->actionRequired = true; });
        homeSpan.autoPoll();
    });

    pluginManager->on("boiler:targetTemperature:change", [this](Event const &event) {
        if (impl->accessory == nullptr)
            return;
        impl->accessory->setTargetTemperature(event.getFloat("value"));
    });

    pluginManager->on("boiler:currentTemperature:change", [this](Event const &event) {
        if (impl->accessory == nullptr)
            return;
        impl->accessory->setCurrentTemperature(event.getFloat("value"));
    });

    pluginManager->on("controller:mode:change", [this](Event const &event) {
        if (impl->accessory == nullptr)
            return;
        impl->accessory->setState(event.getInt("value") != MODE_STANDBY);
    });
}

void HomekitPlugin::loop() {
    if (!impl->actionRequired || impl->controller == nullptr || impl->accessory == nullptr)
        return;
    if (impl->accessory->getState() && impl->controller->getMode() == MODE_STANDBY) {
        impl->controller->deactivateStandby();
    } else if (!impl->accessory->getState() && impl->controller->getMode() != MODE_STANDBY) {
        impl->controller->activateStandby();
    }
    impl->controller->setTargetTemp(impl->accessory->getTargetTemperature());
    impl->actionRequired = false;
}
