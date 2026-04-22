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
#include "../core/utils.h"
#include <utility>

// HomeSpan's Span::pollTask() calls verifyRollbackLater() once as a diagnostic
// log (HomeSpan.cpp:608). Two upstream definitions exist, both excluded from
// our build:
//   1. arduino-esp32 core (cores/esp32/esp32-hal-misc.c) — weak default
//      returning false, gated by #ifdef CONFIG_APP_ROLLBACK_ENABLE which we
//      don't set in sdkconfig.gaggimate.defaults.
//   2. Arduino RainMaker (libraries/RainMaker/src/RMaker.cpp) — strong
//      override returning true, excluded via CONFIG_ARDUINO_SELECTIVE_RainMaker=n.
// HomeSpan's reference is unconditional, so we must provide the symbol. Weak
// so a real RainMaker link (if selective-compilation ever changes) wins.
// Return false to match Arduino's own default; HomeSpan then prints
// "Auto Rollback: Disabled" — truthful for a build with no rollback verifier.
extern "C" __attribute__((weak)) bool verifyRollbackLater() { return false; }

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
        if (impl->spanAccessory != nullptr)
            return; // already begun — handler must be idempotent
        if (event.getInt("AP"))
            return;
        heap_checkpoint("homekit/before-homespan-begin");
        homeSpan.setHostNameSuffix("");
        homeSpan.setPortNum(kHomeSpanPort);
        // Credentials before begin() so HomeSpan's NVS has them before its
        // WiFi supervisor starts — otherwise the watchdog fires on first drop.
        homeSpan.setWifiCredentials(impl->wifiSsid.c_str(), impl->wifiPassword.c_str());
        // Give HomeSpan a no-op WiFi-begin callback: GaggiMate's Controller
        // already owns the STA lifecycle. Without this, HomeSpan's internal
        // WIFI_ALARM watchdog calls ESP.restart() on every WiFi disconnect.
        homeSpan.setWifiBegin([](const char *, const char *) {
            // GaggiMate's Controller owns STA lifecycle; suppress HomeSpan WiFi restarts.
        });
        homeSpan.begin(Category::Thermostats, kDeviceName, impl->controller->getSettings().getMdnsName().c_str());
        impl->spanAccessory = new SpanAccessory();
        impl->accessoryInformation = new Service::AccessoryInformation();
        impl->identify = new Characteristic::Identify();
        impl->accessory = new HomekitAccessory([this]() { impl->actionRequired = true; });
        homeSpan.autoPoll();
        heap_checkpoint("homekit/after-homespan-begin");
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
