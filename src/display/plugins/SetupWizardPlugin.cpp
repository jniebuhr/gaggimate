#include "SetupWizardPlugin.h"
#include <display/core/Controller.h>
#include <display/core/process/Process.h>
#include <display/plugins/WebSocketHandler.h>
#include <vector>
#ifndef GAGGIMATE_SIM
#include <esp_wifi.h>
#endif

namespace {
constexpr unsigned long HEATER_TEST_MS = 10000;
constexpr unsigned long HEATER_SETTLE_MS = 3000; // sensor lags the element, keep watching after it is off
constexpr float HEATER_MIN_RISE = 2.5f;
constexpr float HEATER_HOT_MARGIN = 30.0f;   // this close to the steam target the heater has evidently worked
constexpr float HEATER_ABORT_MARGIN = 15.0f; // steam mode starts the pump near its target

constexpr unsigned long PRESSURE_MIN_BUILD_MS = 3000;
constexpr unsigned long PRESSURE_MAX_BUILD_MS = 10000;
constexpr unsigned long PRESSURE_PLATEAU_MS = 1500;
constexpr unsigned long PRESSURE_RELEASE_MS = 5000;
constexpr unsigned long PRESSURE_SAFETY_MS = 20000;
constexpr float PRESSURE_PLATEAU_STEP = 0.1f;
constexpr float PRESSURE_MIN_PEAK = 10.0f;
constexpr float PRESSURE_HIGH_PEAK = 12.5f;
constexpr float PRESSURE_MAX_RESIDUAL = 1.0f;

constexpr unsigned long PUBLISH_INTERVAL_MS = 250;

constexpr uint32_t SCAN_MIN_MS_PER_CHANNEL = 50;
constexpr uint32_t SCAN_MAX_MS_PER_CHANNEL = 120;
constexpr uint8_t SCAN_HOME_DWELL_MS = 30; // back on the AP channel between channels, keeps phones on the setup page
constexpr unsigned long SCAN_TIMEOUT_MS = 15000;
constexpr size_t SCAN_MAX_RESULTS = 25;

using Phase = SetupWizardPlugin::Phase;

// Pump at full power against the closed 3-way valve, then pump off with the valve open; phase is driven by the plugin.
class PressureTestProcess : public Process {
  public:
    explicit PressureTestProcess(std::shared_ptr<std::atomic<Phase>> phase) : phase(std::move(phase)) {}

    bool isRelayActive() override { return *phase == Phase::RELEASING; }
    bool isAltRelayActive() override { return false; }
    float getPumpValue() override { return *phase == Phase::BUILDING ? 100.0f : 0.0f; }
    void progress() override {}
    bool isActive() override {
        const Phase p = *phase;
        return (p == Phase::BUILDING || p == Phase::RELEASING) && millis() - started < PRESSURE_SAFETY_MS;
    }
    bool isComplete() override { return !isActive(); }
    int getType() override { return MODE_WATER; }
    void updateVolume(double) override {}

  private:
    std::shared_ptr<std::atomic<Phase>> phase;
    unsigned long started = millis();
};

const char *testName(SetupWizardPlugin::Test test) {
    switch (test) {
    case SetupWizardPlugin::Test::HEATER:
        return "heater";
    case SetupWizardPlugin::Test::PRESSURE:
        return "pressure";
    default:
        return "none";
    }
}

const char *phaseName(Phase phase) {
    switch (phase) {
    case Phase::HEATING:
        return "heating";
    case Phase::SETTLING:
        return "settling";
    case Phase::BUILDING:
        return "building";
    case Phase::RELEASING:
        return "releasing";
    case Phase::DONE:
        return "done";
    default:
        return "idle";
    }
}
} // namespace

void SetupWizardPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    this->pluginManager = pluginManager;
    pluginManager->on("webui:ws:register",
                      [this](Event const &event) { registerWsHandlers(event.getPointer<WebSocketHandler>("ws")); });
    WiFi.onEvent([this](WiFiEvent_t, WiFiEventInfo_t) { scanDone = true; }, ARDUINO_EVENT_WIFI_SCAN_DONE);
}

void SetupWizardPlugin::registerWsHandlers(WebSocketHandler *handler) {
    if (handler == nullptr)
        return;
    ws = handler;
    auto reply = [handler](uint32_t clientId, JsonDocument &request, const char *type, const char *error) {
        JsonDocument resp;
        resp["tp"] = type;
        resp["rid"] = request["rid"];
        resp["success"] = error == nullptr;
        if (error != nullptr)
            resp["error"] = error;
        handler->sendJson(clientId, resp);
    };
    ws->registerRequestHandler("req:setup:test:start", [this, reply](uint32_t clientId, JsonDocument &request) {
        const String name = request["test"].as<String>();
        const char *error = nullptr;
        Test wanted = Test::NONE;
        if (name == "heater") {
            wanted = Test::HEATER;
        } else if (name == "pressure") {
            wanted = Test::PRESSURE;
            if (!controller->getSystemInfo().capabilities.pressure)
                error = "noPressureSensor";
            else if (!request["ack"].as<bool>())
                error = "ackRequired"; // the user has to confirm the pressure warning first
        } else {
            error = "unknownTest";
        }
        if (error == nullptr && (test != Test::NONE || requested != Test::NONE || scan != Scan::IDLE || controller->isActive()))
            error = "busy";
        if (error == nullptr && (!controller->isReady() || controller->isErrorState()))
            error = "notReady";
        if (error == nullptr)
            requested = wanted;
        reply(clientId, request, "res:setup:test:start", error);
    });
    ws->registerRequestHandler("req:setup:test:abort", [this, reply](uint32_t clientId, JsonDocument &request) {
        abortRequested = true;
        reply(clientId, request, "res:setup:test:abort", nullptr);
    });
    ws->registerRequestHandler("req:wifi:scan", [this, reply](uint32_t clientId, JsonDocument &request) {
        const char *error = nullptr;
        if (WiFi.getMode() != WIFI_MODE_APSTA)
            error = "notAp"; // only the AP fallback keeps an idle station to scan with
        else if (scan != Scan::IDLE || test != Test::NONE || requested != Test::NONE)
            error = "busy"; // a scan steals radio time from the controller link during a test
        if (error == nullptr)
            scan = Scan::REQUESTED;
        reply(clientId, request, "res:wifi:scan", error);
    });
}

void SetupWizardPlugin::loop() {
    if (scan == Scan::REQUESTED) {
        startScan();
    } else if (scan == Scan::RUNNING) {
        if (scanDone.exchange(false))
            publishScan(true);
        else if (millis() - scanStarted > SCAN_TIMEOUT_MS)
            publishScan(false);
    }

    const Test next = requested.exchange(Test::NONE);
    if (next == Test::HEATER)
        startHeaterTest();
    else if (next == Test::PRESSURE)
        startPressureTest();

    if (test == Test::NONE) {
        abortRequested = false;
        return;
    }
    if (abortRequested.exchange(false)) {
        *phase = Phase::DONE;
        controller->activateStandby();
        if (test == Test::HEATER)
            controller->setBrewHeaterTestActive(false);
        publish("aborted");
        test = Test::NONE;
        return;
    }
    const unsigned long now = millis();
    if (test == Test::HEATER)
        loopHeater(now);
    else
        loopPressure(now);
}

float SetupWizardPlugin::heaterTemp() const {
    return controller->getCurrentTemp(); // Test the brew boiler on every board.
}

float SetupWizardPlugin::heaterTarget() const {
    if (controller->getSystemInfo().capabilities.dualBoiler)
        return controller->getProfileManager()->getSelectedProfile().temperature;
    return static_cast<float>(controller->getSettings().getTargetSteamTemp());
}

void SetupWizardPlugin::startHeaterTest() {
    test = Test::HEATER;
    startTemp = heaterTemp();
    peakTemp = startTemp;
    if (!(startTemp > 0.0f) || startTemp > 200.0f) {
        finish(false, "sensor");
        return;
    }
    if (startTemp > heaterTarget() - HEATER_HOT_MARGIN) {
        finish(true, "alreadyHot");
        return;
    }
    const bool dualBoiler = controller->getSystemInfo().capabilities.dualBoiler;
    // A dual boiler heats its brew boiler in brew mode. Suppress steam heat even
    // when independent steam control is disabled or the enabled state is remembered.
    controller->setBrewHeaterTestActive(dualBoiler);
    controller->setMode(dualBoiler ? MODE_BREW : MODE_STEAM);
    *phase = Phase::HEATING;
    phaseStarted = millis();
    publish("running");
}

void SetupWizardPlugin::loopHeater(unsigned long now) {
    const float temp = heaterTemp();
    peakTemp = std::max(peakTemp, temp);
    if (*phase == Phase::HEATING && temp - startTemp >= HEATER_MIN_RISE) {
        // Enough to prove the heater works, no need to keep heating
        controller->activateStandby();
        finish(true, nullptr);
        return;
    }
    if (*phase == Phase::HEATING) {
        const bool nearTarget = temp > heaterTarget() - HEATER_ABORT_MARGIN;
        const int testMode = controller->getSystemInfo().capabilities.dualBoiler ? MODE_BREW : MODE_STEAM;
        if (now - phaseStarted >= HEATER_TEST_MS || nearTarget || controller->getMode() != testMode) {
            controller->activateStandby();
            *phase = Phase::SETTLING;
            phaseStarted = now;
        }
    } else if (*phase == Phase::SETTLING && now - phaseStarted >= HEATER_SETTLE_MS) {
        const bool passed = peakTemp - startTemp >= HEATER_MIN_RISE;
        finish(passed, passed ? nullptr : "noRise");
        return;
    }
    if (now - lastPublish >= PUBLISH_INTERVAL_MS)
        publish("running");
}

void SetupWizardPlugin::startPressureTest() {
    test = Test::PRESSURE;
    maxPressure = 0.0f;
    riseRef = 0.0f;
    residualPressure = 0.0f;
    controller->activateStandby(); // heater off, nothing else may drive the pump or valve
    *phase = Phase::BUILDING;
    phaseStarted = millis();
    lastRise = phaseStarted;
    controller->startProcess(new PressureTestProcess(phase));
    if (!controller->isActive()) {
        finish(false, "notReady");
        return;
    }
    publish("running");
}

void SetupWizardPlugin::loopPressure(unsigned long now) {
    const float pressure = controller->getCurrentPressure();
    if (!controller->isActive()) {
        // Stopped from the machine (button, safety cap) before the test finished
        *phase = Phase::DONE;
        publish("aborted");
        test = Test::NONE;
        return;
    }
    if (*phase == Phase::BUILDING) {
        maxPressure = std::max(maxPressure, pressure);
        if (pressure > riseRef + PRESSURE_PLATEAU_STEP) {
            riseRef = pressure;
            lastRise = now;
        }
        const unsigned long elapsed = now - phaseStarted;
        const bool plateau = elapsed >= PRESSURE_MIN_BUILD_MS && maxPressure >= 3.0f && now - lastRise >= PRESSURE_PLATEAU_MS;
        if (plateau || elapsed >= PRESSURE_MAX_BUILD_MS) {
            *phase = Phase::RELEASING;
            phaseStarted = now;
        }
    } else if (*phase == Phase::RELEASING && now - phaseStarted >= PRESSURE_RELEASE_MS) {
        residualPressure = pressure;
        *phase = Phase::DONE; // ends the process, the controller closes the valve
        const char *reason = nullptr;
        bool passed = true;
        if (maxPressure < 1.0f) {
            passed = false;
            reason = "noPressure";
        } else if (maxPressure < PRESSURE_MIN_PEAK) {
            passed = false;
            reason = "lowPressure";
        } else if (residualPressure > PRESSURE_MAX_RESIDUAL) {
            passed = false;
            reason = "noRelease";
        } else if (maxPressure > PRESSURE_HIGH_PEAK) {
            reason = "highPressure"; // works, but the OPV is set high
        }
        finish(passed, reason);
        return;
    }
    if (now - lastPublish >= PUBLISH_INTERVAL_MS)
        publish("running");
}

void SetupWizardPlugin::finish(bool passed, const char *reason) {
    if (test == Test::HEATER)
        controller->setBrewHeaterTestActive(false);
    *phase = Phase::DONE;
    publish(passed ? "passed" : "failed", reason);
    test = Test::NONE;
}

void SetupWizardPlugin::publish(const char *state, const char *reason) {
    lastPublish = millis();
    if (ws == nullptr)
        return;
    JsonDocument doc;
    doc["tp"] = "evt:setup:test";
    doc["test"] = testName(test);
    doc["state"] = state;
    doc["phase"] = phaseName(*phase);
    if (reason != nullptr)
        doc["reason"] = reason;
    if (test == Test::HEATER) {
        doc["startTemp"] = startTemp;
        doc["temp"] = heaterTemp();
        doc["rise"] = peakTemp - startTemp;
        doc["targetRise"] = HEATER_MIN_RISE;
    } else {
        doc["pressure"] = controller->getCurrentPressure();
        doc["maxPressure"] = maxPressure;
        doc["residualPressure"] = residualPressure;
    }
    ws->broadcastJson(doc);
}

void SetupWizardPlugin::startScan() {
    WiFi.scanDelete();
    scanDone = false;
#ifdef GAGGIMATE_SIM
    const bool started = WiFi.scanNetworks(true) != WIFI_SCAN_FAILED;
#else
    // Arduino's scanNetworks() leaves home_chan_dwell_time uninitialized; Arduino's SCAN_DONE handler still collects the results
    wifi_scan_config_t config = {};
    config.scan_type = WIFI_SCAN_TYPE_ACTIVE;
    config.scan_time.active.min = SCAN_MIN_MS_PER_CHANNEL;
    config.scan_time.active.max = SCAN_MAX_MS_PER_CHANNEL;
    config.home_chan_dwell_time = SCAN_HOME_DWELL_MS;
    const bool started = esp_wifi_scan_start(&config, false) == ESP_OK;
#endif
    scanStarted = millis();
    scan = Scan::RUNNING;
    if (!started)
        publishScan(false);
}

void SetupWizardPlugin::publishScan(bool success) {
    struct Network {
        String ssid;
        int32_t rssi;
        bool secure;
        int32_t channel;
    };
    std::vector<Network> networks;
    const int16_t count = success ? WiFi.scanComplete() : 0;
    for (int16_t i = 0; i < count; i++) {
        const String ssid = WiFi.SSID(i);
        if (ssid.isEmpty())
            continue;
        const int32_t rssi = WiFi.RSSI(i);
        auto existing = std::find_if(networks.begin(), networks.end(), [&](const Network &n) { return n.ssid == ssid; });
        if (existing != networks.end()) {
            if (rssi > existing->rssi)
                *existing = {ssid, rssi, WiFi.encryptionType(i) != WIFI_AUTH_OPEN, WiFi.channel(i)}; // strongest mesh node
            continue;
        }
        networks.push_back({ssid, rssi, WiFi.encryptionType(i) != WIFI_AUTH_OPEN, WiFi.channel(i)});
    }
    WiFi.scanDelete();
    std::sort(networks.begin(), networks.end(), [](const Network &a, const Network &b) { return a.rssi > b.rssi; });
    if (networks.size() > SCAN_MAX_RESULTS)
        networks.resize(SCAN_MAX_RESULTS);
    scan = Scan::IDLE;

    if (ws == nullptr)
        return;
    JsonDocument doc;
    doc["tp"] = "evt:wifi:scan";
    doc["success"] = success && count >= 0;
    JsonArray list = doc["networks"].to<JsonArray>();
    for (const auto &n : networks) {
        JsonObject entry = list.add<JsonObject>();
        entry["ssid"] = n.ssid;
        entry["rssi"] = n.rssi;
        entry["secure"] = n.secure;
        entry["channel"] = n.channel;
    }
    ws->broadcastJson(doc);
}
