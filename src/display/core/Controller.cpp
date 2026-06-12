#include "Controller.h"
#include "ArduinoJson.h"
#include "esp_coexist.h"
#include "esp_sntp.h"
#include <LittleFS.h>
#include <SD_MMC.h>
#include <cmath>
#include <ctime>
#include <display/config.h>
#include <display/core/constants.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/GrindProcess.h>
#include <display/core/process/PumpProcess.h>
#include <display/core/process/SteamProcess.h>
#include <display/core/static_profiles.h>
#include <display/core/zones.h>
#include <display/plugins/AutoWakeupPlugin.h>
#include <display/plugins/BLEScalePlugin.h>
#include <display/plugins/BoilerFillPlugin.h>
#include <display/plugins/HomekitPlugin.h>
#include <display/plugins/LedControlPlugin.h>
#include <display/plugins/MQTTPlugin.h>
#include <display/plugins/NetworkWatchdogPlugin.h>
#include <display/plugins/ShotHistoryPlugin.h>
#include <display/plugins/SmartGrindPlugin.h>
#include <display/plugins/WebUIPlugin.h>
#include <display/plugins/WifiStaWatchdogPlugin.h>
#include <display/plugins/mDNSPlugin.h>
#include <display/util/PsramAllocator.h>
#ifndef GAGGIMATE_HEADLESS
#include <display/drivers/AmoledDisplayDriver.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#endif

const String LOG_TAG = F("Controller");

void Controller::setup() {
    mode = settings.getStartupMode();

    // Web assets are served from this partition. LittleFS (not SPIFFS): SPIFFS
    // has no directory tree, so stat()/exists() is O(whole filesystem) and a
    // miss scans every page -- the web handler does that synchronously in the
    // async_tcp task for every request, which under a multi-tab load burst
    // pegged CPU0 for >5s and tripped the task watchdog (reboot). LittleFS
    // lookups are O(path). maxOpenFiles 16 for concurrent asset serving. [GM-90]
    if (!LittleFS.begin(true, "/littlefs", 16)) {
        Serial.println(F("An Error has occurred while mounting LittleFS"));
    }

#ifndef GAGGIMATE_HEADLESS
    setupPanel();
#endif

    pluginManager = new PluginManager();
#ifndef GAGGIMATE_HEADLESS
    ui = new DefaultUI(this, driver, pluginManager);
    if (driver->supportsSDCard() && driver->installSDCard()) {
        sdcard = true;
        ESP_LOGI(LOG_TAG, "SD Card detected and mounted");
        ESP_LOGI(LOG_TAG, "Used: %lluMB, Capacity: %lluMB", SD_MMC.usedBytes() / 1024 / 1024, SD_MMC.cardSize() / 1024 / 1024);
    }
#endif
    FS *fs = &LittleFS;
    if (sdcard) {
        fs = &SD_MMC;
    }
    profileManager = new ProfileManager(fs, "/p", settings, pluginManager);
    profileManager->setup();
    if (settings.isHomekit())
        pluginManager->registerPlugin(new HomekitPlugin(settings.getWifiSsid(), settings.getWifiPassword()));
    else
        pluginManager->registerPlugin(new mDNSPlugin());
    if (settings.isBoilerFillActive()) {
        pluginManager->registerPlugin(new BoilerFillPlugin());
    }
    if (settings.isSmartGrindActive()) {
        pluginManager->registerPlugin(new SmartGrindPlugin());
    }
    if (settings.isHomeAssistant()) {
        pluginManager->registerPlugin(new MQTTPlugin());
    }
    pluginManager->registerPlugin(new WebUIPlugin());
    pluginManager->registerPlugin(new NetworkWatchdogPlugin());
    pluginManager->registerPlugin(new WifiStaWatchdogPlugin());
    pluginManager->registerPlugin(&ShotHistory);
    pluginManager->registerPlugin(&BLEScales);
    pluginManager->registerPlugin(new LedControlPlugin());
    pluginManager->registerPlugin(new AutoWakeupPlugin());
    pluginManager->setup(this);

    pluginManager->on("profiles:profile:save", [this](Event const &event) {
        String id = event.getString("id");
        if (id == profileManager->getSelectedProfile().id) {
            this->handleProfileUpdate();
        }
    });

    pluginManager->on("profiles:profile:select", [this](Event const &event) { this->handleProfileUpdate(); });

#ifndef GAGGIMATE_HEADLESS
    ui->init();
#endif
    this->onScreenReady();

    updateLastAction();
    xTaskCreatePinnedToCore(loopTask, "Controller::loopControl", configMINIMAL_STACK_SIZE * 6, this, 2, &taskHandle, 0);
    xTaskCreatePinnedToCore(loopLogicTask, "Controller::loopLogic", configMINIMAL_STACK_SIZE * 6, this, 3, &logicTaskHandle, 0);
}

void Controller::onScreenReady() { screenReady = true; }

void Controller::onTargetToggle() { settings.setVolumetricTarget(!settings.isVolumetricTarget()); }

void Controller::onTargetChange(ProcessTarget target) { settings.setVolumetricTarget(target == ProcessTarget::VOLUMETRIC); }

void Controller::connect() {
    lastPing = millis();
    connectStartTime = millis();
    pluginManager->trigger("controller:startup");

    setupWifi();
    setupBluetooth();
    pluginManager->on("ota:update:start", [this](Event const &) { this->updating = true; });
    pluginManager->on("ota:update:end", [this](Event const &) { this->updating = false; });

    updateLastAction();
    initialized = true;
}

#ifndef GAGGIMATE_HEADLESS
void Controller::setupPanel() {
    if (LilyGoDriver::getInstance()->isCompatible()) {
        driver = LilyGoDriver::getInstance();
    } else if (AmoledDisplayDriver::getInstance()->isCompatible()) {
        driver = AmoledDisplayDriver::getInstance();
    } else if (WaveshareDriver::getInstance()->isCompatible()) {
        driver = WaveshareDriver::getInstance();
    } else {
        Serial.println("No compatible display driver found");
        delay(10000);
        ESP.restart();
    }
    driver->init();
}
#endif

// Parse a comma-separated float string ("a,b,c,d") into `out`. Missing fields
// are left at `def` -- used so pump-model coeffs can carry NaN to signal
// two-point flow-measurement mode, and an absent PID Kf defaults to 0.
static void parseFloatCsv(const String &csv, float *out, size_t count, float def) {
    for (size_t i = 0; i < count; i++)
        out[i] = def;
    int start = 0;
    for (size_t i = 0; i < count; i++) {
        if (start > csv.length())
            break;
        int comma = csv.indexOf(',', start);
        String token = (comma < 0) ? csv.substring(start) : csv.substring(start, comma);
        token.trim();
        if (token.length() > 0)
            out[i] = token.toFloat();
        if (comma < 0)
            break;
        start = comma + 1;
    }
}

void Controller::setupBluetooth() {
    comms.init("GPBLC");
    comms.onConnectionChanged([this](bool connected) {
        // Force a full control resend after any (re)connect -- the controller
        // starts with no state and updateControl() otherwise only sends deltas.
        controlStateSent = false;
        if (connected) {
            // Re-assert the connection interval for the fresh link (e.g. tight
            // again if we reconnected mid-shot).
            applyConnectionPriority(true);
        } else if (initialized) {
            pluginManager->trigger("controller:bluetooth:disconnect");
            waitingForController = true;
            setMode(MODE_STANDBY);
        }
    });
    comms.onSystemInfo([this](const char *hardware, const char *version, uint32_t protocolVersion, bool dimming, bool pressure,
                              bool ledControl, bool tof, vector<uint32_t> addons) {
        onSystemInfo(hardware, version, protocolVersion, dimming, pressure, ledControl, tof, addons);
    });
    comms.onIncompatibleController([this](const String &info) { onIncompatibleController(info); });
    // A controller OTA streams the firmware over this BLE link; the relaxed idle
    // interval makes that crawl. Force a low-latency interval for the duration of
    // a controller flash, then restore. (A display OTA is Wi-Fi-bound, so leave
    // BLE relaxed to keep radio airtime for the download.)
    pluginManager->on("ota:update:start", [this](Event const &event) {
        if (event.getString("component") != "display") {
            connLowLatency = true;
            comms.setLowLatency(true);
            // Streaming firmware over BLE -> BLE must win the shared radio, same
            // as during a shot. Without this it would run against the new
            // idle WiFi-preference and crawl. Restored by applyConnectionPriority
            // on ota:update:end. [GM-90]
            esp_coex_preference_set(ESP_COEX_PREFER_BT);
        }
    });
    pluginManager->on("ota:update:end", [this](Event const &) { applyConnectionPriority(true); });
    comms.onSensorData([this](float temp, float pressure, float puckFlow, float pumpFlow, float puckResistance) {
        onTempRead(temp);
        this->pressure = pressure;
        this->currentPuckFlow = puckFlow;
        this->currentPumpFlow = pumpFlow;
        pluginManager->trigger("boiler:pressure:change", "value", pressure);
        pluginManager->trigger("pump:puck-flow:change", "value", puckFlow);
        pluginManager->trigger("pump:flow:change", "value", pumpFlow);
        pluginManager->trigger("pump:puck-resistance:change", "value", puckResistance);
    });
    comms.onButtonState([this](uint8_t index, bool pressed) {
        const int status = pressed ? 1 : 0;
        String behavior = settings.getButtonBehavior(index);
        ESP_LOGV("Controller", "Button %d changed to %d, behavior: %s", index, status, behavior);
        if (behavior == "" || behavior == "none") {
            return;
        }
        if (behavior == "brew") {
            handleBrewButton(status);
            return;
        }
        if (behavior == "steam") {
            handleSteamButton(status);
            return;
        }
        if (behavior == "water") {
            handleWaterButton(status);
            return;
        }
        if (behavior == "flush") {
            // Flush is a one-shot fixed-duration BrewProcess. Trigger on
            // press only; release does nothing so the user can't
            // accidentally cancel mid-flush by letting go (push button)
            // or flipping the rocker back. onFlush() itself is a no-op
            // if a process is already active, so rapid presses don't
            // queue.
            //
            // Ensure we land in MODE_BREW so the flush UI renders, but
            // only when no other process is currently running. Mutating
            // mode mid-process would orphan the active mode's UI while
            // onFlush() silently no-ops on the re-entrancy guard. The
            // setMode guard mirrors the pattern other button handlers
            // use when they need to switch modes safely.
            if (status) {
                if (getMode() == MODE_STANDBY) {
                    deactivateStandby();
                }
                if (getMode() != MODE_BREW && !isActive()) {
                    setMode(MODE_BREW);
                }
                onFlush();
            }
            return;
        }
        handleProfileButton(status, behavior);
    });
    comms.onError([this](int error) {
        // Autotune timeout = info-level, not runaway. Controller already
        // preserved NVS PID. Clear autotuning flag, fire dedicated Web UI
        // event. Don't latch this->error (would gate future setupBluetooth).
        if (error == ERROR_CODE_AUTOTUNE_TIMEOUT) {
            ESP_LOGW(LOG_TAG, "Autotune timed out — previous PID preserved");
            autotuning = false;
            pluginManager->trigger("controller:autotune:failed");
            return;
        }
        if (error != ERROR_CODE_TIMEOUT && error != this->error) {
            this->error = error;
            deactivate();
            setMode(MODE_STANDBY);
            pluginManager->trigger(F("controller:error"));
            ESP_LOGE(LOG_TAG, "Received error %d", error);
        }
    });
    comms.onAutotuneResult([this](float Kp, float Ki, float Kd, float Kf) {
        ESP_LOGI(LOG_TAG, "Received autotune values: Kp=%.3f, Ki=%.3f, Kd=%.3f, Kf=%.3f (combined)", Kp, Ki, Kd, Kf);
        // Guard: older controller firmware could emit zero/NaN gains (#672
        // class). Reject — keep existing PID, surface as "Autotune Failed".
        if (!std::isfinite(Kp) || !std::isfinite(Ki) || !std::isfinite(Kd) || !std::isfinite(Kf) || Kp <= 0.0f ||
            (Kp + Ki + Kd) <= 0.0f) {
            ESP_LOGW(LOG_TAG, "Rejecting autotune result: invalid gains, preserving existing PID");
            autotuning = false;
            pluginManager->trigger("controller:autotune:failed");
            return;
        }
        char pid[64];
        // Store in simplified format with combined Kf
        snprintf(pid, sizeof(pid), "%.3f,%.3f,%.3f,%.3f", Kp, Ki, Kd, Kf);
        settings.setPid(String(pid));
        pluginManager->trigger("controller:autotune:result");
        autotuning = false;
    });
    comms.onVolumetricMeasurement(
        [this](float value) { onVolumetricMeasurement(value, VolumetricMeasurementSource::FLOW_ESTIMATION); });
    comms.onTofMeasurement([this](uint32_t value) {
        tofDistance = static_cast<int>(value);
        ESP_LOGV(LOG_TAG, "Received new TOF distance: %d", tofDistance);
        pluginManager->trigger("controller:tof:change", "value", tofDistance);
    });
    pluginManager->trigger("controller:bluetooth:init");
}

void Controller::onSystemInfo(const char *hardware, const char *version, uint32_t protocolVersion, bool dimming, bool pressure,
                              bool ledControl, bool tof, vector<uint32_t> addons) {
    const bool mismatch = protocolVersion != gm_proto::PROTOCOL_VERSION;
    systemInfo = SystemInfo{.hardware = String(hardware),
                            .version = String(version),
                            .capabilities =
                                SystemCapabilities{
                                    .dimming = dimming,
                                    .pressure = pressure,
                                    .ledControl = ledControl,
                                    .tof = tof,
                                    .addons = addons,
                                },
                            .protocolVersion = protocolVersion,
                            .protocolMismatch = mismatch};
    ESP_LOGI(LOG_TAG, "System info: %s %s (proto=%u local=%u dm=%d ps=%d led=%d tof=%d)", hardware, version, protocolVersion,
             gm_proto::PROTOCOL_VERSION, dimming, pressure, ledControl, tof);
    if (mismatch) {
        // Mixed-firmware links are not wire-compatible, so don't push config and
        // don't drive control (updateControl() also bails on protocolMismatch).
        // We still fire controller:ready below so OTA can init -- that's the
        // recovery path to update the out-of-date side.
        ESP_LOGW(LOG_TAG, "Protocol version mismatch: controller=%u display=%u -- control inhibited, OTA only", protocolVersion,
                 gm_proto::PROTOCOL_VERSION);
        pluginManager->trigger("controller:protocol:mismatch", "value", static_cast<int>(protocolVersion));
    } else {
        // Capability-dependent setup that the old protocol ran synchronously right
        // after connect, now driven by the asynchronous SystemInfo push.
        setPressureScale();
        float pid[4];
        parseFloatCsv(settings.getPid(), pid, 4, 0.0f);
        comms.sendPidSettings(pid[0], pid[1], pid[2], pid[3]);
        setPumpModelCoeffs();
    }

    if (!loaded) {
        loaded = true;
        if (!mismatch && settings.getStartupMode() == MODE_STANDBY)
            activateStandby();
        pluginManager->trigger("controller:ready");
    }
    pluginManager->trigger("controller:bluetooth:connect");
}

void Controller::onIncompatibleController(const String &infoJson) {
    // An old controller (no framed-comms characteristics) is, for our purposes,
    // a protocol mismatch: reuse the exact same path. We force protocolVersion 0
    // (it cannot speak the framed protocol), so onSystemInfo() inhibits control
    // but still fires controller:ready so OTA can flash the controller back into
    // compatibility. The real hardware/version/capabilities come from the legacy
    // read-only INFO characteristic the old controller still exposes.
    waitingForController = false;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, infoJson);
    if (err) {
        ESP_LOGW(LOG_TAG, "Incompatible controller, no readable info (%s)", err.c_str());
        onSystemInfo("Legacy controller", "0.0.0", 0, false, false, false, false, {});
        return;
    }
    String hardware = doc["hw"].as<String>();
    String version = doc["v"].as<String>();
    if (hardware.isEmpty())
        hardware = "Legacy controller";
    if (version.isEmpty())
        version = "0.0.0";
    onSystemInfo(hardware.c_str(), version.c_str(), 0, doc["cp"]["dm"].as<bool>(), doc["cp"]["ps"].as<bool>(),
                 doc["cp"]["led"].as<bool>(), doc["cp"]["tof"].as<bool>(), {});
}

void Controller::setupWifi() {
    if (settings.getWifiSsid() != "" && settings.getWifiPassword() != "") {
        WiFi.setHostname(settings.getMdnsName().c_str());
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, INADDR_NONE);

        // Register WiFi event handlers BEFORE begin() so STA_CONNECTED and
        // STA_GOT_IP from the boot connect fire through them too. Handlers
        // run in the Arduino WiFi event task (small stack), so they only log
        // and flag; loop() fires plugin events on the main loop.
        WiFi.onEvent(
            [this](WiFiEvent_t, WiFiEventInfo_t info) {
                const auto &g = info.got_ip.ip_info;
                const uint32_t ip = g.ip.addr;
                const uint32_t gw = g.gw.addr;
                ESP_LOGI(LOG_TAG, "STA got IP: %u.%u.%u.%u gw=%u.%u.%u.%u", (unsigned)(ip & 0xff), (unsigned)((ip >> 8) & 0xff),
                         (unsigned)((ip >> 16) & 0xff), (unsigned)((ip >> 24) & 0xff), (unsigned)(gw & 0xff),
                         (unsigned)((gw >> 8) & 0xff), (unsigned)((gw >> 16) & 0xff), (unsigned)((gw >> 24) & 0xff));
                wifiConnectedPending = true;
            },
            WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_GOT_IP);
        // setMinSecurity() is a scan filter, not an auth ceiling -- the SDK
        // can still negotiate WPA3-SAE on a WPA3-transition AP, so log the
        // authmode it actually chose, the BSSID of the AP we landed on
        // (useful in multi-AP topologies), and the channel.
        WiFi.onEvent(
            [](WiFiEvent_t, WiFiEventInfo_t info) {
                const auto &c = info.wifi_sta_connected;
                ESP_LOGI(LOG_TAG, "STA connected: ssid=%.*s bssid=%02x:%02x:%02x:%02x:%02x:%02x ch=%u authmode=%u",
                         (int)c.ssid_len, c.ssid, c.bssid[0], c.bssid[1], c.bssid[2], c.bssid[3], c.bssid[4], c.bssid[5],
                         c.channel, c.authmode);
            },
            WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_CONNECTED);
        // Log numeric reason explicitly -- disconnectReasonName() returns NULL
        // for vendor codes (UniFi 168), which made earlier logs read
        // "Reason:" with empty body and obscured the root cause.
        WiFi.onEvent(
            [this](WiFiEvent_t, WiFiEventInfo_t info) {
                const auto &d = info.wifi_sta_disconnected;
                const char *name = WiFi.disconnectReasonName(static_cast<wifi_err_reason_t>(d.reason));
                ESP_LOGW(LOG_TAG, "STA disconnected: reason=%u (%s) bssid=%02x:%02x:%02x:%02x:%02x:%02x ssid=%.*s", d.reason,
                         name && *name ? name : "vendor/unknown", d.bssid[0], d.bssid[1], d.bssid[2], d.bssid[3], d.bssid[4],
                         d.bssid[5], (int)d.ssid_len, d.ssid);
                wifiDisconnectedPending = true;
            },
            WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
        WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t) { ESP_LOGW(LOG_TAG, "STA lost IP"); },
                     WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_LOST_IP);
        WiFi.onEvent(
            [](WiFiEvent_t, WiFiEventInfo_t info) {
                ESP_LOGW(LOG_TAG, "STA authmode changed: %u -> %u", info.wifi_sta_authmode_change.old_mode,
                         info.wifi_sta_authmode_change.new_mode);
            },
            WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_AUTHMODE_CHANGE);

        WiFi.begin(settings.getWifiSsid(), settings.getWifiPassword());
        WiFi.setTxPower(WIFI_POWER_19_5dBm);
        for (int attempts = 0; attempts < WIFI_CONNECT_ATTEMPTS; attempts++) {
            if (WiFi.status() == WL_CONNECTED) {
                break;
            }
            delay(500);
            Serial.print(".");
        }
        Serial.println("");
        if (WiFi.status() == WL_CONNECTED) {
            ESP_LOGI(LOG_TAG, "Connected to %s with IP address %s", settings.getWifiSsid().c_str(),
                     WiFi.localIP().toString().c_str());
            configTzTime(resolve_timezone(settings.getTimezone()), NTP_SERVER);
            setenv("TZ", resolve_timezone(settings.getTimezone()), 1);
            tzset();
            sntp_set_sync_mode(SNTP_SYNC_MODE_SMOOTH);
            sntp_setservername(0, NTP_SERVER);
            sntp_init();
        } else {
            WiFi.disconnect(true, true);
            ESP_LOGI(LOG_TAG, "Timed out while connecting to WiFi");
            Serial.println("Timed out while connecting to WiFi");
        }
    }
    if (WiFi.status() != WL_CONNECTED) {
        isApConnection = true;
        WiFi.mode(WIFI_AP);
        WiFi.softAPConfig(WIFI_AP_IP, WIFI_AP_IP, WIFI_SUBNET_MASK);
        WiFi.softAP(WIFI_AP_SSID);
        WiFi.setTxPower(WIFI_POWER_19_5dBm);
        ESP_LOGI(LOG_TAG, "Started WiFi AP %s", WIFI_AP_SSID);
    }

    pluginManager->on("ota:update:start", [this](Event const &) { this->updating = true; });
    pluginManager->on("ota:update:end", [this](Event const &) { this->updating = false; });

    // STA path: STA_GOT_IP handler already set wifiConnectedPending; loop()
    // dispatches controller:wifi:connect from there. AP path has no STA_GOT_IP,
    // so it needs the explicit trigger here.
    if (isApConnection) {
        pluginManager->trigger("controller:wifi:connect", "AP", 1);
    }
}

void Controller::loop() {
    // Act on WiFi link-state changes flagged by the (small-stack) event task here
    // on the main loop. Disconnect before connect so a flap is ordered correctly.
    if (wifiDisconnectedPending) {
        wifiDisconnectedPending = false;
        pluginManager->trigger("controller:wifi:disconnect");
    }
    if (wifiConnectedPending) {
        wifiConnectedPending = false;
        pluginManager->trigger("controller:wifi:connect", "AP", isApConnection ? 1 : 0);
    }

    pluginManager->loop();

    if (screenReady && !initialized) {
        connect();
    }

    if (initialized) {
        comms.loop(); // drive the comms send pump + retransmit
    }

    unsigned long now = millis();

    // If BLE scanning has been running for a while without finding the controller,
    // notify the UI so it can update the startup label accordingly.
    if (!waitingForController && initialized && !comms.isConnected() &&
        (now - connectStartTime) > CONTROLLER_WAITING_TIMEOUT_MS) {
        waitingForController = true;
        pluginManager->trigger("controller:bluetooth:waiting");
    }

    if (comms.isReadyForConnection() && comms.connectToServer()) {
        waitingForController = false;
    }

    // Keepalive: updateControl() only sends control deltas now, so a steady-state
    // session would otherwise go silent. A periodic ping keeps the controller's
    // connection watchdog fed (sent in all states, including error). Skip it for
    // an incompatible controller -- it can't parse the frame anyway.
    if (comms.isConnected() && !systemInfo.protocolMismatch && now - lastPing >= PING_INTERVAL) {
        comms.sendPing();
        lastPing = now;
    }
}

void Controller::loopLogic() {
    if (isErrorState()) {
        return;
    }

    // Check if steam is ready
    if (mode == MODE_STEAM && !steamReady && currentTemp + 5.f > getTargetTemp()) {
        activate();
        steamReady = true;
    }

    // Handle current process
    if (currentProcess != nullptr) {
        updateLastAction();
        if (currentProcess->getType() == MODE_BREW) {
            auto brewProcess = static_cast<BrewProcess *>(currentProcess);
            brewProcess->updatePressure(pressure);
            brewProcess->updateFlow(currentPumpFlow);
        }
        currentProcess->progress();
        if (!isActive()) {
            deactivate();
        }
    }

    // Handle last process - Calculate auto delay
    if (lastProcess != nullptr && !lastProcess->isComplete()) {
        lastProcess->progress();
    }
    if (lastProcess != nullptr && lastProcess->isComplete() && !processCompleted && settings.isDelayAdjust()) {
        processCompleted = true;
        if (lastProcess->getType() == MODE_BREW) {
            if (auto *brewProcess = static_cast<BrewProcess *>(lastProcess); brewProcess->target == ProcessTarget::VOLUMETRIC) {
                double newDelay = brewProcess->getNewDelayTime();
                if (newDelay >= 0) {
                    settings.setBrewDelay(newDelay);
                }
            }
        } else if (lastProcess->getType() == MODE_GRIND) {
            if (auto *grindProcess = static_cast<GrindProcess *>(lastProcess);
                grindProcess->target == ProcessTarget::VOLUMETRIC) {
                double newDelay = grindProcess->getNewDelayTime();
                if (newDelay >= 0) {
                    settings.setGrindDelay(newDelay);
                }
            }
        }
    }

    unsigned long now = millis();

    if (grindActiveUntil != 0 && now > grindActiveUntil)
        deactivateGrind();
    if (mode != MODE_STANDBY && settings.getStandbyTimeout() > 0 && now > lastAction + settings.getStandbyTimeout())
        activateStandby();
}

void Controller::loopControl() {
    if (initialized) {
        updateControl();
    }
}

bool Controller::isUpdating() const { return updating; }

bool Controller::isAutotuning() const { return autotuning; }

bool Controller::isReady() const { return !isUpdating() && !isErrorState() && !isAutotuning(); }

bool Controller::isVolumetricAvailable() const {
#ifdef NIGHTLY_BUILD
    return isBluetoothScaleHealthy() || systemInfo.capabilities.dimming;
#else
    return isBluetoothScaleHealthy();
#endif
}

void Controller::autotune(int testTime, int samples, int heaterWattage) {
    if (isActive() || !isReady()) {
        return;
    }
    if (mode != MODE_STANDBY) {
        activateStandby();
    }
    autotuning = true;
    comms.sendAutotune(testTime, samples, heaterWattage);
    pluginManager->trigger("controller:autotune:start");
}

void Controller::startProcess(Process *process) {
    if (isActive() || !isReady()) {
        delete process;
        return;
    }
    processCompleted = false;
    this->currentProcess = process;
    applyConnectionPriority(); // shot started -> tight BLE interval
    pluginManager->trigger("controller:process:start");
    updateLastAction();
}

void Controller::applyConnectionPriority(bool force) {
    // A running process needs responsive 10Hz control; idle does not. Track the
    // last requested state so we only renegotiate on transitions.
    const bool lowLatency = currentProcess != nullptr;
    if (force || lowLatency != connLowLatency) {
        connLowLatency = lowLatency;
        comms.setLowLatency(lowLatency);
        // Steer the shared-radio coexistence arbiter to match. WiFi and BLE
        // share one 2.4GHz radio; the arbiter decides who wins on contention.
        // During a shot the BLE control loop (7.5-10ms interval, pressure/flow
        // feedback) must win, so prefer BT. When idle there is no tight BLE
        // deadline, so prefer WiFi to keep the web UI / network responsive --
        // the chronic coex failure mode is WiFi getting starved and the whole
        // IP stack wedging. Default coex preference is BALANCE; nobody set this
        // before. Best-effort: ignore the return (no-op if coex inactive). [GM-90]
        esp_coex_preference_set(lowLatency ? ESP_COEX_PREFER_BT : ESP_COEX_PREFER_WIFI);
    }
}

float Controller::getTargetTemp() const {
    Process *proc = currentProcess;
    switch (mode) {
    case MODE_BREW:
    case MODE_GRIND:
        if (proc != nullptr && proc->isActive() && proc->getType() == MODE_BREW) {
            auto brewProcess = static_cast<BrewProcess *>(proc);
            return brewProcess->getTemperature();
        }
        return profileManager->getSelectedProfile().temperature;
    case MODE_STEAM:
        return settings.getTargetSteamTemp();
    case MODE_WATER:
        return settings.getTargetWaterTemp();
    default:
        return 0;
    }
}

void Controller::setTargetTemp(float temperature) {
    pluginManager->trigger("boiler:targetTemperature:change", "value", temperature);
    switch (mode) {
    case MODE_BREW:
    case MODE_GRIND:
        profileManager->getSelectedProfile().temperature = temperature;
        break;
    case MODE_STEAM:
        settings.setTargetSteamTemp(static_cast<int>(temperature));
        break;
    case MODE_WATER:
        settings.setTargetWaterTemp(static_cast<int>(temperature));
        break;
    default:;
    }
    updateLastAction();
}

void Controller::setPressureScale(void) {
    if (systemInfo.capabilities.pressure) {
        comms.sendPressureScale(settings.getPressureScaling());
    }
}

void Controller::setPumpModelCoeffs(void) {
    if (systemInfo.capabilities.dimming) {
        // Default missing coeffs to NaN so a two-value "a,b" string keeps its
        // flow-measurement semantics (c,d NaN) on the controller side.
        float coeffs[4];
        parseFloatCsv(settings.getPumpModelCoeffs(), coeffs, 4, NAN);
        bool gearpumpEnabled = systemInfo.capabilities.hasAddon(7);
        comms.sendPumpSettings(coeffs[0], coeffs[1], coeffs[2], coeffs[3],
                               gearpumpEnabled ? settings.getCommutationGain() : DEFAULT_COMMUTATION_GAIN,
                               gearpumpEnabled ? settings.getConvergenceGain() : DEFAULT_CONVERGENCE_GAIN,
                               gearpumpEnabled ? settings.getIntegralGain() : DEFAULT_INTEGRAL_GAIN, settings.getMaxPumpPower());
    }
}

int Controller::getTargetGrindDuration() const { return settings.getTargetGrindDuration(); }

void Controller::setTargetGrindDuration(int duration) {
    Event event = pluginManager->trigger("controller:grindDuration:change", "value", duration);
    settings.setTargetGrindDuration(event.getInt("value"));
    updateLastAction();
}

void Controller::setTargetGrindVolume(double volume) {
    Event event = pluginManager->trigger("controller:grindVolume:change", "value", static_cast<float>(volume));
    settings.setTargetGrindVolume(event.getFloat("value"));
    updateLastAction();
}

void Controller::raiseTemp() {
    float temp = getTargetTemp();
    temp = constrain(temp + 1.0f, MIN_TEMP, MAX_TEMP);
    setTargetTemp(temp);
}

void Controller::lowerTemp() {
    float temp = getTargetTemp();
    temp = constrain(temp - 1.0f, MIN_TEMP, MAX_TEMP);
    setTargetTemp(temp);
}

void Controller::raiseBrewTarget() {
    if (isVolumetricAvailable() && profileManager->getSelectedProfile().isVolumetric()) {
        profileManager->getSelectedProfile().adjustVolumetricTarget(1);
    } else {
        profileManager->getSelectedProfile().adjustDuration(1);
    }
    handleProfileUpdate();
}

void Controller::lowerBrewTarget() {
    if (isVolumetricAvailable() && profileManager->getSelectedProfile().isVolumetric()) {
        profileManager->getSelectedProfile().adjustVolumetricTarget(-1);
    } else {
        profileManager->getSelectedProfile().adjustDuration(-1);
    }
    handleProfileUpdate();
}

void Controller::raiseGrindTarget() {
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        double newTarget = settings.getTargetGrindVolume() + 0.5;
        if (newTarget > BREW_MAX_VOLUMETRIC) {
            newTarget = BREW_MAX_VOLUMETRIC;
        }
        setTargetGrindVolume(newTarget);
    } else {
        int newDuration = getTargetGrindDuration() + 1000;
        if (newDuration > BREW_MAX_DURATION_MS) {
            newDuration = BREW_MAX_DURATION_MS;
        }
        setTargetGrindDuration(newDuration);
    }
}

void Controller::lowerGrindTarget() {
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        double newTarget = settings.getTargetGrindVolume() - 0.5;
        if (newTarget < BREW_MIN_VOLUMETRIC) {
            newTarget = BREW_MIN_VOLUMETRIC;
        }
        setTargetGrindVolume(newTarget);
    } else {
        int newDuration = getTargetGrindDuration() - 1000;
        if (newDuration < BREW_MIN_DURATION_MS) {
            newDuration = BREW_MIN_DURATION_MS;
        }
        setTargetGrindDuration(newDuration);
    }
}

void Controller::updateControl() {
    // Never drive a controller whose protocol version we don't match -- the
    // commands could be misinterpreted (OTA recovery still works; see onSystemInfo).
    if (systemInfo.protocolMismatch) {
        return;
    }

    // Local capture to avoid race condition with deactivate() running on another core
    Process *proc = currentProcess;
    bool active = isActive();

    float targetTemp = getTargetTemp();
    if (targetTemp > .0f) {
        targetTemp = targetTemp + static_cast<float>(settings.getTemperatureOffset());
    }

    bool altRelayActive = false;
    if (active && proc->isAltRelayActive()) {
        if (proc->getType() == MODE_GRIND && settings.getAltRelayFunction() == ALT_RELAY_GRIND) {
            altRelayActive = true;
        }
    }

    // Build the per-component commands, then deliver boiler + pump + valve + alt
    // together in a single batched frame so the controller applies them as one
    // atomic update.
    BoilerCommand boiler;
    boiler.index = 0;
    boiler.setpoint = targetTemp;
    PumpCommand pump;
    pump.index = 0;
    RelayCommand relay; // index 0 = brew valve
    relay.index = 0;

    bool handled = false;
    if (active && systemInfo.capabilities.pressure) {
        if (proc->getType() == MODE_STEAM) {
            targetPressure = settings.getSteamPumpCutoff();
            targetFlow = proc->getPumpValue() * 0.1f;
            relay.open = false;
            pump.mode = PumpControlMode::Flow; // flow target, pressure as the limit
            pump.flow = targetFlow;
            pump.pressure = targetPressure;
            handled = true;
        } else if (proc->getType() == MODE_BREW) {
            auto *brewProcess = static_cast<BrewProcess *>(proc);
            if (brewProcess->isAdvancedPump()) {
                const bool pressureTarget = brewProcess->getPumpTarget() == PumpTarget::PUMP_TARGET_PRESSURE;
                relay.open = brewProcess->isRelayActive();
                pump.mode = pressureTarget ? PumpControlMode::Pressure : PumpControlMode::Flow;
                pump.pressure = brewProcess->getPumpPressure();
                pump.flow = brewProcess->getPumpFlow();
                targetPressure = brewProcess->getPumpPressure();
                targetFlow = brewProcess->getPumpFlow();
                handled = true;
            }
        }
    }

    if (!handled) {
        targetPressure = 0.0f;
        targetFlow = 0.0f;
        relay.open = active && proc->isRelayActive();
        pump.mode = PumpControlMode::Power;
        pump.power = active ? proc->getPumpValue() : 0;
    }

    // Only send components that changed since the last update. The controller is
    // stateful and every message is acknowledged, so re-sending unchanged values
    // each cycle is unnecessary; a periodic ping (see loop()) keeps the watchdog
    // fed when nothing changes. controlStateSent is reset on (re)connect to force
    // a full resend.
    gm::Payload batch[4];
    size_t count = 0;
    if (!controlStateSent || boiler != lastBoiler)
        batch[count++] = comms.buildBoilerControl(boiler.index, boiler.mode, boiler.setpoint);
    if (!controlStateSent || pump != lastPump)
        batch[count++] = comms.buildPumpControl(pump.index, pump.mode, pump.power, pump.pressure, pump.flow);
    if (!controlStateSent || relay != lastRelay)
        batch[count++] = comms.buildRelayControl(relay.index, relay.open); // index 0 = brew valve
    if (!controlStateSent || altRelayActive != lastAlt)
        batch[count++] = comms.buildRelayControl(1, altRelayActive); // index 1 = alt relay

    if (count > 0)
        comms.sendBatch(batch, count);

    lastBoiler = boiler;
    lastPump = pump;
    lastRelay = relay;
    lastAlt = altRelayActive;
    controlStateSent = true;
}

void Controller::activate() {
    if (isActive())
        return;
    clear();
    comms.tare();
    if (isVolumetricAvailable()) {
#ifdef NIGHTLY_BUILD
        currentVolumetricSource =
            isBluetoothScaleHealthy() ? VolumetricMeasurementSource::BLUETOOTH : VolumetricMeasurementSource::FLOW_ESTIMATION;
#else
        currentVolumetricSource = VolumetricMeasurementSource::BLUETOOTH;
#endif
        if (mode == MODE_BREW) {
            pluginManager->trigger("controller:brew:prestart");
        }
    }
    delay(200);
    switch (mode) {
    case MODE_BREW:
        startProcess(new BrewProcess(profileManager->getSelectedProfile(),
                                     profileManager->getSelectedProfile().isVolumetric() && isVolumetricAvailable()
                                         ? ProcessTarget::VOLUMETRIC
                                         : ProcessTarget::TIME,
                                     settings.getBrewDelay()));
        break;
    case MODE_STEAM:
        startProcess(new SteamProcess(STEAM_SAFETY_DURATION_MS, settings.getSteamPumpPercentage()));
        break;
    case MODE_WATER:
        startProcess(new PumpProcess());
        break;
    default:;
    }
    if (currentProcess != nullptr && currentProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:start");
    }
}

void Controller::deactivate() {
    if (currentProcess == nullptr) {
        return;
    }
    delete lastProcess;
    lastProcess = currentProcess;
    currentProcess = nullptr;
    applyConnectionPriority(); // shot ended -> relaxed BLE interval
    if (lastProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:end");
    } else if (lastProcess->getType() == MODE_GRIND) {
        pluginManager->trigger("controller:grind:end");
    }
    pluginManager->trigger("controller:process:end");
    updateLastAction();
}

void Controller::clear() {
    processCompleted = true;
    if (lastProcess != nullptr && lastProcess->getType() == MODE_BREW) {
        pluginManager->trigger("controller:brew:clear");
    }
    delete lastProcess;
    lastProcess = nullptr;
    currentVolumetricSource = VolumetricMeasurementSource::INACTIVE;
}

void Controller::activateGrind() {
    pluginManager->trigger("controller:grind:start");
    if (isGrindActive())
        return;
    clear();
    if (settings.isVolumetricTarget() && isVolumetricAvailable()) {
        currentVolumetricSource = VolumetricMeasurementSource::BLUETOOTH;
        startProcess(new GrindProcess(ProcessTarget::VOLUMETRIC, 0, settings.getTargetGrindVolume(), settings.getGrindDelay()));
    } else {
        startProcess(
            new GrindProcess(ProcessTarget::TIME, settings.getTargetGrindDuration(), settings.getTargetGrindVolume(), 0.0));
    }
}

void Controller::deactivateGrind() {
    deactivate();
    clear();
}

void Controller::activateStandby() {
    setMode(MODE_STANDBY);
    deactivate();
}

void Controller::deactivateStandby() {
    deactivate();
    setMode(MODE_BREW);
}

bool Controller::isActive() const {
    Process *proc = currentProcess;
    return proc != nullptr && proc->isActive();
}

bool Controller::isGrindActive() const {
    Process *proc = currentProcess;
    return proc != nullptr && proc->isActive() && proc->getType() == MODE_GRIND;
}

int Controller::getMode() const { return mode; }

void Controller::setMode(int newMode) {
    Event modeEvent = pluginManager->trigger("controller:mode:change", "value", newMode);
    mode = modeEvent.getInt("value");
    steamReady = false;

    updateLastAction();
    setTargetTemp(getTargetTemp());
}

void Controller::onTempRead(float temperature) {
    float temp = temperature - static_cast<float>(settings.getTemperatureOffset());
    Event event = pluginManager->trigger("boiler:currentTemperature:change", "value", temp);
    currentTemp = event.getFloat("value");
}

void Controller::updateLastAction() { lastAction = millis(); }

void Controller::onOTAUpdate() {
    activateStandby();
    updating = true;
}

void Controller::onProfileSave() const { profileManager->saveProfile(profileManager->getSelectedProfile()); }

void Controller::onProfileSaveAsNew() {
    Profile &profile = profileManager->getSelectedProfile();
    profile.label = "Copy of " + profileManager->getSelectedProfile().label;
    profile.id = generateShortID();
    settings.setSelectedProfile(profile.id);
    profileManager->saveProfile(profileManager->getSelectedProfile());
    profileManager->addFavoritedProfile(profile.id);
}

void Controller::onVolumetricMeasurement(double measurement, VolumetricMeasurementSource source) {
    pluginManager->trigger(source == VolumetricMeasurementSource::FLOW_ESTIMATION
                               ? F("controller:volumetric-measurement:estimation:change")
                               : F("controller:volumetric-measurement:bluetooth:change"),
                           "value", static_cast<float>(measurement));
    if (source == VolumetricMeasurementSource::BLUETOOTH) {
        lastBluetoothMeasurement = millis();
    }

    if (currentVolumetricSource != source) {
        ESP_LOGD(LOG_TAG, "Ignoring volumetric measurement, source does not match");
        return;
    }
    // Local capture to avoid use-after-free with deactivate() / clear() running
    // on another core. This callback fires from the NimBLE task on core 0 each
    // time the BLE scale reports weight; deactivate() / clear() run on core 1
    // (AsyncTCP/LVGL) and can `delete lastProcess` between our nullptr check
    // and the dereference. Mirrors the same capture pattern used in
    // updateControl() above (see comment around line 560).
    Process *curr = currentProcess;
    Process *last = lastProcess;
    if (curr != nullptr) {
        curr->updateVolume(measurement);
    }
    if (last != nullptr && !last->isComplete()) {
        last->updateVolume(measurement);
    }
}

bool Controller::isBluetoothScaleHealthy() const {
    unsigned long timeSinceLastBluetooth = millis() - lastBluetoothMeasurement;
    return (timeSinceLastBluetooth < BLUETOOTH_GRACE_PERIOD_MS) || volumetricOverride;
}

void Controller::onFlush() {
    if (isActive()) {
        return;
    }
    clear();
    startProcess(new BrewProcess(FLUSH_PROFILE, ProcessTarget::TIME, settings.getBrewDelay()));
    pluginManager->trigger("controller:brew:start");
}

void Controller::onVolumetricDelete() {
    if (profileManager->getSelectedProfile().isVolumetric()) {
        profileManager->getSelectedProfile().removeVolumetricTarget();
    }
}

void Controller::handleBrewButton(int brewButtonStatus) {
    if (brewButtonStatus) {
        switch (getMode()) {
        case MODE_STANDBY:
            deactivateStandby();
            break;
        case MODE_BREW:
            if (!isActive()) {
                deactivateStandby();
                clear();
                activate();
            } else if (settings.isMomentaryButtons()) {
                deactivate();
                clear();
            }
            break;
        case MODE_WATER:
            activate();
            break;
        case MODE_STEAM:
            deactivate();
            setMode(MODE_BREW);
        default:
            break;
        }
    } else if (!settings.isMomentaryButtons()) {
        if (getMode() == MODE_BREW) {
            if (isActive()) {
                deactivate();
                clear();
            } else {
                clear();
            }
        } else if (getMode() == MODE_WATER) {
            deactivate();
        }
    }
}

void Controller::handleSteamButton(int steamButtonStatus) {
    if (steamButtonStatus) {
        if (getMode() != MODE_STEAM) {
            setMode(MODE_STEAM);
        }
    } else if (!settings.isMomentaryButtons() && getMode() == MODE_STEAM) {
        deactivate();
        setMode(MODE_BREW);
    }
}

void Controller::handleWaterButton(int buttonStatus) {
    if (buttonStatus) {
        switch (getMode()) {
        case MODE_WATER:
            if (!isActive()) {
                activate();
            }
            break;
        default:
            setMode(MODE_WATER);
            break;
        }
    } else if (!settings.isMomentaryButtons() && getMode() == MODE_WATER && isActive()) {
        deactivate();
    }
}

void Controller::handleProfileButton(int buttonStatus, String id) {
    if (buttonStatus && getMode() == MODE_STANDBY) {
        deactivateStandby();
        return;
    }
    if (!buttonStatus && !settings.isMomentaryButtons()) {
        deactivate();
        clear();
    }
    if (buttonStatus) {
        if (getMode() != MODE_BREW) {
            setMode(MODE_BREW);
        }
        if (isActive()) {
            deactivate();
            clear();
            return;
        }
        std::vector<String> profileIds = profileManager->listProfiles();
        if (std::find(profileIds.begin(), profileIds.end(), id) != profileIds.end()) {
            profileManager->selectProfile(id);
            activate();
        }
    }
}

void Controller::handleProfileUpdate() {
    pluginManager->trigger("boiler:targetTemperature:change", "value", profileManager->getSelectedProfile().temperature);
    pluginManager->trigger("controller:targetDuration:change", "value", profileManager->getSelectedProfile().getTotalDuration());
    pluginManager->trigger("controller:targetVolume:change", "value", profileManager->getSelectedProfile().getTotalVolume());
}

void Controller::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *controller = static_cast<Controller *>(arg);
    while (true) {
        controller->loopControl();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(controller->getMode() == MODE_STANDBY ? 1000 : PROGRESS_INTERVAL));
    }
}

void Controller::loopLogicTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *controller = static_cast<Controller *>(arg);
    while (true) {
        controller->loopLogic();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(controller->getMode() == MODE_STANDBY ? 1000 : PROGRESS_INTERVAL));
    }
}
