#include "GaggiMateController.h"
#include "MachineHardwareSettings.h"
#include "utilities.h"
#include <Arduino.h>
#include <ExtensionIOXL9555.hpp>
#include <Preferences.h>
#include <peripherals/DimmedPump.h>
#include <peripherals/SimplePump.h>

#include <memory>
#include <peripherals/NtcThermistor.h>
#include <utility>

constexpr uint32_t ADDON_GEARPUMP = 7;
constexpr uint32_t ADDON_HW_SCALE = 8;

GaggiMateController::GaggiMateController(String version) : _version(std::move(version)) {
    configs.push_back(GM_STANDARD_REV_1X);
    configs.push_back(GM_STANDARD_REV_2X);
    configs.push_back(GM_STANDARD_REV_3X);
    configs.push_back(GM_PRO_REV_1x);
    configs.push_back(GM_PRO_LEGO);
    configs.push_back(GM_PRO_REV_11);
    configs.push_back(GM_MAX_REV10);
}

bool GaggiMateController::isSteamSwitchOn() const {
    pinMode(_config.steamButtonPin, INPUT_PULLUP);
    for (int i = 0; i < 5; i++) { // active low; require a steady reading so a bouncing contact never opens the window
        if (digitalRead(_config.steamButtonPin) != LOW)
            return false;
        delay(10);
    }
    return true;
}

void GaggiMateController::setup() {
    delay(5000);
    hardwareRequests = xQueueCreate(1, sizeof(gm::MachineHardwareSettings));
    configASSERT(hardwareRequests);
    detectBoard();
    loadMachineHardware();
    detectAddon();

    if (!_config.capabilites.dualBoiler) {
        brewTemperature = std::make_unique<Max31855Thermocouple>(
            _config.maxCsPin, _config.maxMisoPin, _config.maxSckPin, [this](float temperature) { /* noop */ },
            [this]() { thermalRunawayShutdown(); });
    }
    if (_config.capabilites.pressure || _config.capabilites.dualBoiler) {
        adc = std::make_unique<ADSAdc>(_config.pressureSda, _config.pressureScl, _config.adcRates,
                                       gearpumpAddon ? gearpumpAddon->sharedBusMutex() : nullptr);
        pressureSensor = std::make_unique<PressureSensor>(this->adc.get(), _config.pressureControlRate);
        if (_config.capabilites.dualBoiler) {
            this->brewTemperature = std::make_unique<NtcThermistor>(
                this->adc.get(), 2, [this]() { thermalRunawayShutdown(); }, machineHardware.ntc_brew_nominal_resistance,
                machineHardware.ntc_brew_series_resistance, machineHardware.ntc_brew_supply_voltage,
                machineHardware.ntc_brew_beta, _config.ntcTiming[2]);
            this->steamTemperature = std::make_unique<NtcThermistor>(
                this->adc.get(), 3, [this]() { thermalRunawayShutdown(); }, machineHardware.ntc_steam_nominal_resistance,
                machineHardware.ntc_steam_series_resistance, machineHardware.ntc_steam_supply_voltage,
                machineHardware.ntc_steam_beta, _config.ntcTiming[3]);
        }
    }
    heater = std::make_unique<Heater>(
        this->brewTemperature.get(), _config.heaterPin, [this]() { thermalRunawayShutdown(); },
        [this](float Kp, float Ki, float Kd, float Kf) { _comms.sendAutotuneResult(Kp, Ki, Kd, Kf); },
        [this]() { _comms.sendError(ERROR_CODE_AUTOTUNE_TIMEOUT); });
    if (_config.capabilites.dualBoiler) {
        heater2 = std::make_unique<Heater>(
            this->steamTemperature.get(), _config.altPin, [this]() { thermalRunawayShutdown(); },
            [this](float Kp, float Ki, float Kd, float Kf) { _comms.sendAutotuneResult(Kp, Ki, Kd, Kf); },
            [this]() { _comms.sendError(ERROR_CODE_AUTOTUNE_TIMEOUT); });
        heaterCoordinator = std::make_unique<HeaterCoordinator>(heater.get(), heater2.get());
        refill = std::make_unique<SimpleRelay>(_config.refillPin, _config.valveOn);
        aux = std::make_unique<SimpleRelay>(_config.auxPin, _config.valveOn);
        if (machineHardware.steam_level_enabled && _config.waterSensePin != 0)
            waterSense = std::make_unique<DigitalInput>(
                _config.waterSensePin,
                [this](const bool state) {
                    steamLevelLow = state;
                    steamLevelKnown = true;
                    if (_config.capabilites.dualBoiler && machineHardware.steam_level_enabled && state && heater2)
                        heater2->setSetpoint(0);
                    _comms.sendButtonState(3, state);
                },
                machineHardware.steam_level_debounce_checks, 1);
        if (_config.capabilites.dualBoiler) {
            if (machineHardware.tank_level_enabled && _config.tankLevelPin != 0)
                tankLevel = std::make_unique<DigitalInput>(_config.tankLevelPin, [this](bool full) { tankLevelOK = full; });
        }
        if (_config.ledPin != 0)
            lights = std::make_unique<PwmLight>(_config.ledPin, 0);
        if (_config.baristaLedPin != 0)
            baristaLight = std::make_unique<PwmLight>(_config.baristaLedPin, 1);
    } else {
        alt = std::make_unique<SimpleRelay>(_config.altPin, _config.altOn);
    }
    valve = std::make_unique<SimpleRelay>(_config.valvePin, _config.valveOn);
    if (_config.capabilites.dimming) {
        pump = std::make_unique<DimmedPump>(_config.pumpPin, _config.pumpSensePin, pressureSensor.get(),
                                            _config.pressureControlRate);
    } else {
        pump = std::make_unique<SimplePump>(_config.pumpPin, _config.pumpOn, _config.capabilites.ssrPump ? 1000.0f : 5000.0f);
    }
    brewBtn =
        std::make_unique<DigitalInput>(_config.brewButtonPin, [this](const bool state) { _comms.sendButtonState(0, state); });
    steamBtn =
        std::make_unique<DigitalInput>(_config.steamButtonPin, [this](const bool state) { _comms.sendButtonState(1, state); });
    if (_config.waterButtonPin != 0) {
        waterBtn = std::make_unique<DigitalInput>(_config.waterButtonPin,
                                                  [this](const bool state) { _comms.sendButtonState(2, state); });
    }
    this->hardwareScale = std::make_unique<HardwareScale>(
        _config.scaleDat0Pin, _config.scaleDat1Pin, _config.scaleClkPin,
        [this](float weight, float cell1Weight, float cell2Weight, bool cell1Valid, bool cell2Valid) {
            if (_comms.isConnected()) {
                _comms.sendScaleMeasurement(weight, cell1Weight, cell2Weight, cell1Valid, cell2Valid);
            }
        },
        [](float, float) { /* scale config changes are not forwarded */ });

    // 4-Pin peripheral port
    if (_config.sunriseSdaPin != 0 && _config.sunriseSclPin != 0) {
        albaComms = std::make_unique<SoftWire>(_config.sunriseSdaPin, _config.sunriseSclPin);
        albaComms->setTxBuffer(albaSwTxBuffer.data(), albaSwTxBuffer.size());
        albaComms->setRxBuffer(albaSwRxBuffer.data(), albaSwRxBuffer.size());
        albaComms->setTimeout_ms(200);
        albaComms->setDelay_us(20);
        albaComms->begin();
        albaBus = std::make_unique<SoftWireBus>(albaComms.get());
        this->ledController = std::make_unique<LedController>(albaBus.get());
        if (this->ledController->isAvailable()) {
            _config.capabilites.ledControls = true;
            // A configured Max tank switch owns tank reporting. Alba lighting
            // still works, but never starts a competing distance stream.
            if (tankLevel == nullptr) {
                distanceSensor = std::make_unique<DistanceSensor>(albaBus.get(),
                                                                  [this](int distance) { _comms.sendTofMeasurement(distance); });
                _config.capabilites.tof = true;
            }
        }
    }
    if (!_config.capabilites.dualBoiler && !_config.capabilites.tof && _config.tankLevelPin > 0) {
        tankLevel = std::make_unique<DigitalInput>(
            _config.tankLevelPin,
            [this](const bool full) {
                tankLevelOK = full;
                sendTankLevel();
            },
            5);
    }
    gm::DeviceCapabilities capabilities = gaggimate_Capabilities_init_zero;
    capabilities.dimming = _config.capabilites.dimming;
    capabilities.pressure = _config.capabilites.pressure;
    capabilities.tof = _config.capabilites.tof || tankLevel != nullptr;
    capabilities.led_control = _config.capabilites.ledControls;
    capabilities.dual_boiler = _config.capabilites.dualBoiler;

    this->hardwareScale->setup();

    auto addAddon = [&capabilities](uint32_t type) {
        const auto maxAddons = sizeof(capabilities.addons) / sizeof(capabilities.addons[0]);
        if (capabilities.addons_count >= maxAddons) {
            return;
        }
        capabilities.addons[capabilities.addons_count] = gaggimate_Addon_init_zero;
        capabilities.addons[capabilities.addons_count].type = type;
        capabilities.addons_count++;
    };
    if (this->gearpumpAddon != nullptr) {
        addAddon(ADDON_GEARPUMP);
    }
    if (this->hardwareScale->isAvailable()) {
        addAddon(ADDON_HW_SCALE);
    }

    // Steam switch held at power-on opens the BLE pairing window; read it here since steamBtn->setup() runs later.
    _comms.init("GPBLS", _config.name.c_str(), _version, capabilities, isSteamSwitchOn());

    if (_config.capabilites.ledControls) {
        ledController->setup();
    }
    if (_config.capabilites.tof) {
        distanceSensor->setup();
    }

    if (this->gearpumpAddon != nullptr) {
        this->gearpumpAddon->setup(this->pump->getPumpPowerPtr());
        auto dimmedPump = static_cast<DimmedPump *>(pump.get());
        dimmedPump->setBinaryMode(true);
    }
    if (_config.capabilites.pressure || _config.capabilites.dualBoiler) {
        pressureSensor->setup();
        this->adc->setup();
        _comms.onPressureScale([this](float scale) { this->pressureSensor->setScale(scale); });
    }
    _comms.onLedControl(
        [this](uint8_t channel, uint8_t brightness, LedEffect effect, uint8_t minBrightness, uint16_t cycleTimeMs) {
            if (channel == SYSTEM_LED_CHANNEL && lights)
                lights->set(effect, brightness, minBrightness, cycleTimeMs);
            else if (channel == BARISTA_LED_CHANNEL && baristaLight)
                baristaLight->set(effect, brightness, minBrightness, cycleTimeMs);
            else if (channel < SYSTEM_LED_CHANNEL && ledController)
                ledController->setChannel(channel, brightness);
        });
    brewTemperature->setup();
    heater->setup();
    valve->setup();
    pump->setup();
    brewBtn->setup();
    steamBtn->setup();
    if (waterBtn != nullptr) {
        waterBtn->setup();
    }
    if (_config.capabilites.dualBoiler) {
        steamTemperature->setup();
        heater2->setup();
        refill->setup();
        aux->setup();
        if (waterSense)
            waterSense->setup();
        if (lights)
            lights->setup();
        if (baristaLight)
            baristaLight->setup();
    } else {
        alt->setup();
    }
    if (tankLevel != nullptr) {
        tankLevel->setup();
    }
    // Set up thermal feedforward for main heater if pressure/dimming capability exists
    if (heater && _config.capabilites.dimming && _config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump.get());
        float *pumpFlowPtr = dimmedPump->getPumpFlowPtr();
        int *valveStatusPtr = dimmedPump->getValveStatusPtr();

        heater->setThermalFeedforward(pumpFlowPtr, 23.0f, valveStatusPtr);
        heater->setFeedforwardScale(0.0f);
    }
    // Initialize last ping time
    lastPingTime = millis();

    // Output control is split into per-component, device-numbered messages. Each
    // arrives independently (or batched together in one frame for an atomic
    // update). Control messages feed the connection watchdog via handlePing().
    _comms.onBoilerControl([this](uint8_t index, BoilerControlMode mode, float setpoint) {
        if (!_config.capabilites.dualBoiler && index > 0) {
            return;
        }
        if (_config.capabilites.dualBoiler && !hardwareSessionReady)
            return;
        Heater *target = index == 0 ? this->heater.get() : this->heater2.get();
        handlePing();
        if (errorState != ERROR_CODE_NONE) {
            return;
        }
        if (mode == BoilerControlMode::Temperature) {
            if (_config.capabilites.dualBoiler && index == 1) {
                steamRequestedSetpoint = setpoint;
                target->setSetpoint(machineHardware.steam_level_enabled && (!steamLevelKnown || steamLevelLow) ? 0.0f : setpoint);
            } else {
                target->setSetpoint(setpoint);
            }
        } else {
            // Pressure-regulated boiler not supported by this hardware yet.
            ESP_LOGW(LOG_TAG, "Boiler pressure mode requested but unsupported");
        }
    });
    _comms.onPumpControl([this](uint8_t index, PumpControlMode mode, float power, float pressure, float flow) {
        if (index != 0) { // single pump today; reject unknown devices
            ESP_LOGW(LOG_TAG, "Ignoring pump control for unsupported index %u", index);
            return;
        }
        handlePing();
        if (errorState != ERROR_CODE_NONE) {
            return;
        }
        if (mode == PumpControlMode::Power) {
            this->pump->setPower(power); // the gear pump task applies a new power, including 0, within 30 ms
            return;
        }
        if (!_config.capabilites.dimming) {
            return;
        }
        auto dimmedPump = static_cast<DimmedPump *>(pump.get());
        if (mode == PumpControlMode::Pressure) {
            dimmedPump->setPressureTarget(pressure, flow);
        } else { // PumpControlMode::Flow
            dimmedPump->setFlowTarget(flow, pressure);
        }
    });
    // Binary outputs: index 0 = brew valve, index 1 = alt relay,
    // index 2 = steam refill, index 3 = steam-pressure hot-water valve.
    _comms.onRelayControl([this](uint8_t index, bool open) {
        handlePing();
        if (errorState != ERROR_CODE_NONE) {
            return;
        }
        if (_config.capabilites.dualBoiler) {
            switch (index) {
            case 2:
                this->refill->set(open && hardwareSessionReady);
                return;
            case 3:
                this->aux->set(open);
                return;
            default:
                // noop
                break;
            }
        } else if (index == 1) {
            // Alt relay: independent function, no watchdog/error gating (matches
            // the previous dedicated alt-control path).
            this->alt->set(open);
            return;
        }
        if (index != 0) {
            ESP_LOGW(LOG_TAG, "Ignoring relay control for unsupported index %u", index);
            return;
        }
        this->valve->set(open);
        if (_config.capabilites.dimming) {
            static_cast<DimmedPump *>(pump.get())->setValveState(open);
        }
    });
    _comms.onMachineHardware(
        [this](const gm::MachineHardwareSettings &settings) { xQueueOverwrite(hardwareRequests, &settings); });
    // Heaters stay off until the display delivers these; coordination is applied before the gains enable heating.
    _comms.onHeaterSettings([this](const gm::HeaterSettings &settings) {
        if (heaterCoordinator != nullptr) {
            heaterCoordinator->configure(settings.heater_coordination_enabled, settings.handover_ms);
        }
        heater->setFeedforwardScale(settings.kf);
        heater->setTunings(settings.kp, settings.ki, settings.kd);
        if (heater2 != nullptr) {
            heater2->setTunings(settings.steam_kp, settings.steam_ki, settings.steam_kd);
        }
    });
    _comms.onPumpSettings([this](gm::PumpSettings settings) {
        if (_config.capabilites.dimming) {
            auto dimmedPump = static_cast<DimmedPump *>(pump.get());
            // Check if this is a flow measurement call (a and b are flow measurements, c and d are nan)
            if (isnan(settings.c) && isnan(settings.d)) {
                dimmedPump->setPumpFlowCoeff(settings.a, settings.b); // a = oneBarFlow, b = nineBarFlow
            } else {
                dimmedPump->setPumpFlowPolyCoeffs(settings.a, settings.b, settings.c,
                                                  settings.d); // a, b, c, d are polynomial coefficients
            }
            if (this->gearpumpAddon != nullptr) {
                dimmedPump->setGains(settings.commutationGain, settings.convergenceGain, settings.integralGain);
                // Slip model is only meaningful for the positive-displacement gear/rotary-vane pump.
                dimmedPump->setPumpSlipPolyCoeffs(settings.slipA, settings.slipB, settings.slipC, settings.slipD);
            }
        }
        if (this->gearpumpAddon != nullptr) {
            gearpumpAddon->setMaxPower(settings.maxBLDCPower);
        }
    });
    _comms.onPing([this]() { handlePing(); });
    // A new link gets a full ping window; a stale lastPingTime would trip the watchdog while the display is still
    // discovering services. errorState is left alone so a timed-out session only recovers on a real ping.
    _comms.onConnectionChange([this](bool connected) {
        if (connected) {
            lastPingTime = millis();
            controllerErrorPending = true;
        }
    });
    _comms.onAutotune([this](uint32_t testTimeSec, uint32_t windowSize, uint32_t heaterWattage) {
        if (_config.capabilites.dualBoiler && !hardwareSessionReady)
            return;
        handlePing();
        if (errorState != ERROR_CODE_NONE) { // don't re-engage the heater while faulted
            return;
        }
        this->heater->autotune(static_cast<int>(testTimeSec), static_cast<int>(windowSize), static_cast<int>(heaterWattage));
    });
    _comms.onHardwareScaleTare([this]() {
        if (hardwareScale != nullptr && hardwareScale->isAvailable()) {
            hardwareScale->tare();
        }
    });
    _comms.onTare([this]() {
        if (!_config.capabilites.dimming) {
            return;
        }
        auto dimmedPump = static_cast<DimmedPump *>(pump.get());
        dimmedPump->tare();
    });
    _comms.onScaleFactors(
        [this](float scaleFactor1, float scaleFactor2, uint16_t sampleRateSps, float idleFilterAlpha, float activeFilterAlpha) {
            if (hardwareScale == nullptr || !hardwareScale->isAvailable()) {
                return;
            }
            hardwareScale->setConfiguration(scaleFactor1, scaleFactor2, sampleRateSps, idleFilterAlpha, activeFilterAlpha);
        });
    ESP_LOGI(LOG_TAG, "Initialization done");
}

void GaggiMateController::loop() {
    gm::MachineHardwareSettings requested;
    bool hardwareStatusPending = xQueueReceive(hardwareRequests, &requested, 0) == pdTRUE;
    if (hardwareStatusPending)
        storeMachineHardware(requested);
    if (hardwareConfigurationAccepted && !hardwareConfigurationError && !hardwareSessionReady &&
        !brewTemperature->isErrorState() && !steamTemperature->isErrorState()) {
        hardwareSessionReady = true;
        hardwareStatusPending = true;
    }
    if (hardwareStatusPending)
        _comms.sendMachineHardwareStatus(machineHardwareHash(machineHardware), hardwareSessionReady, hardwareConfigurationError);
    // Report a pre-existing fault after the encrypted comms session is established.
    // NONE also clears the display's old fault after a successful controller restart.
    if (_comms.isConnected() && controllerErrorPending.exchange(false))
        _comms.sendError(errorState);
    unsigned long now = millis();

    // Keep zero tracking and idle display quantization out of the measurement
    // path whenever the brew valve or pump can be adding liquid to the cup.
    if (hardwareScale != nullptr) {
        const float pumpPower = pump != nullptr && pump->getPumpPowerPtr() != nullptr ? *pump->getPumpPowerPtr() : 0.0f;
        const bool scaleActivity = (valve != nullptr && valve->getState()) || pumpPower > 0.01f ||
                                   (_config.capabilites.dualBoiler && aux != nullptr && aux->getState());
        hardwareScale->setBrewingActive(scaleActivity);
    }

    if (lastPingTime < now && (now - lastPingTime) / 1000 > PING_TIMEOUT_SECONDS) {
        handlePingTimeout();
    }
    if (_config.capabilites.dualBoiler)
        updateDualBoilerOutputs(now);
    if (!_config.capabilites.dualBoiler || lastSensorSend == 0 || now - lastSensorSend >= 250) {
        sendSensorData();
        lastSensorSend = now;
    }
    if (_config.capabilites.ledControls && now - lastLedHealthCheck >= LED_HEALTH_CHECK_INTERVAL_MS) {
        lastLedHealthCheck = now;
        ledController->healthCheck();
    }
    if (tankLevel != nullptr && now - lastTankLevelSend >= TANK_LEVEL_SEND_INTERVAL_MS) {
        sendTankLevel();
    }
    if (errorState != ERROR_CODE_NONE && errorState != ERROR_CODE_TIMEOUT) {
        ESP_LOGW("GaggiMateController", "Error state: %d", errorState);
    }
    delay(_config.capabilites.dualBoiler ? 50 : 250);
    if (Serial.available()) {
        while (Serial.available()) {
            char c = Serial.read();
            handleSerialCommand(c);
        }
    }
}

// Reed switch closed (state true) means water present, so report a full-tank distance.
void GaggiMateController::sendTankLevel() {
    lastTankLevelSend = millis();
    _comms.sendTofMeasurement(tankLevel->getState() ? 10 : 1000);
}

void GaggiMateController::registerBoardConfig(ControllerConfig config) { configs.push_back(config); }

void GaggiMateController::detectBoard() {
    constexpr int MAX_DETECT_RETRIES = 3;
    pinMode(DETECT_EN_PIN, OUTPUT);
    pinMode(DETECT_VALUE_PIN, INPUT_PULLDOWN);

    for (int attempt = 0; attempt < MAX_DETECT_RETRIES; attempt++) {
        digitalWrite(DETECT_EN_PIN, HIGH);
        delay(10); // Allow voltage to stabilize before ADC read
        uint16_t millivolts = analogReadMilliVolts(DETECT_VALUE_PIN);
        digitalWrite(DETECT_EN_PIN, LOW);
        int boardId = round(((float)millivolts) / 100.0f - 0.5f);
        ESP_LOGI(LOG_TAG, "Board detect attempt %d/%d: ID=%d (raw: %d mV)", attempt + 1, MAX_DETECT_RETRIES, boardId, millivolts);
        for (ControllerConfig config : configs) {
            if (config.autodetectValue == boardId) {
                _config = config;
                ESP_LOGI(LOG_TAG, "Using Board: %s", _config.name.c_str());
                return;
            }
        }
        ESP_LOGW(LOG_TAG, "No match on attempt %d, retrying...", attempt + 1);
        delay(500);
    }
    ESP_LOGE(LOG_TAG, "No compatible board detected after %d attempts. Restarting...", MAX_DETECT_RETRIES);
    delay(5000);
    ESP.restart();
}

void GaggiMateController::updateDualBoilerOutputs(unsigned long now) {
    const bool safe = errorState == ERROR_CODE_NONE && hardwareSessionReady;
    const float target = safe && (!machineHardware.steam_level_enabled || (steamLevelKnown && !steamLevelLow))
                             ? steamRequestedSetpoint.load()
                             : 0.0f;
    if (heater2->getSetpoint() != target)
        heater2->setSetpoint(target);
    const bool fault = !safe || (machineHardware.tank_level_enabled && !tankLevelOK);
    if (lights)
        lights->update(now, fault, safe);
    if (baristaLight)
        baristaLight->update(now, false, safe);
}

void GaggiMateController::detectAddon() {
    const bool sharedAdcBus = (_config.capabilites.pressure || _config.capabilites.dualBoiler) &&
                              _config.ext3Pin == _config.pressureSda && _config.ext2Pin == _config.pressureScl;
    TwoWire &bus = sharedAdcBus ? Wire1 : Wire;
    if (!bus.begin(_config.ext3Pin, _config.ext2Pin, ADC_I2C_CLOCK_HZ)) {
        ESP_LOGE(LOG_TAG, "Could not initialize addon bus");
        return;
    }
    for (uint8_t addr = XL9555_SLAVE_ADDRESS0; addr <= XL9555_SLAVE_ADDRESS7; ++addr) {
        bus.beginTransmission(addr);
        if (bus.endTransmission() == 0) {
            ESP_LOGI(LOG_TAG, "Found an extension at address 0x%X", addr);
            if (addr == 0x26) {
                ESP_LOGI(LOG_TAG, "Identified addon as Gearpump Addon");
                gearpumpAddon =
                    std::make_unique<GearpumpAddon>(addr, _config.ext3Pin, _config.ext2Pin, _config.ext1Pin, bus, sharedAdcBus);
            }
        }
    }
}

void GaggiMateController::handlePing() {
    if (errorState == ERROR_CODE_TIMEOUT) {
        errorState = ERROR_CODE_NONE;
    }
    lastPingTime = millis();
    ESP_LOGV(LOG_TAG, "Ping received, system is alive");
}

void GaggiMateController::clearRetainedOutputDemands() { steamRequestedSetpoint = 0.0f; }

void GaggiMateController::handlePingTimeout() {
    clearRetainedOutputDemands();
    // Turn off the heater and pump as a safety measure
    this->heater->stop();
    this->pump->setPower(0);
    this->valve->set(false);
    if (_config.capabilites.dualBoiler) {
        this->heater2->stop();
        this->refill->set(false);
        this->aux->set(false);
        if (baristaLight)
            baristaLight->stop();
    } else {
        this->alt->set(false);
    }
    // A communication timeout must not turn a latched thermal fault into a recoverable error.
    if (errorState != ERROR_CODE_NONE && errorState != ERROR_CODE_TIMEOUT)
        return;
    // On the healthy->timeout transition, drop the BLE link. An in-band error
    // notify can be silently swallowed on a wedged GATT (the failure mode this
    // is here to recover from), but LL_TERMINATE_IND propagates reliably at
    // the link layer. The display's existing disconnect path then rebuilds
    // the link and re-sends control state. loop() re-enters every 250 ms while
    // timed out -- guard so we don't repeatedly bounce the connection or spam
    // the log.
    if (errorState != ERROR_CODE_TIMEOUT) {
        ESP_LOGE(LOG_TAG, "Ping timeout detected. Turning off heater and pump for safety.");
        if (!_comms.isUpdating())
            _comms.disconnect();
    }
    errorState = ERROR_CODE_TIMEOUT;
}

void GaggiMateController::thermalRunawayShutdown() {
    if (errorState == ERROR_CODE_RUNAWAY)
        return;
    clearRetainedOutputDemands();
    ESP_LOGE(LOG_TAG, "Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    this->heater->stop();
    this->pump->setPower(0);
    this->valve->set(false);
    if (_config.capabilites.dualBoiler) {
        this->heater2->stop();
        this->refill->set(false);
        this->aux->set(false);
        if (baristaLight)
            baristaLight->stop();
    } else {
        this->alt->set(false);
    }
    errorState = ERROR_CODE_RUNAWAY;
    _comms.sendError(ERROR_CODE_RUNAWAY);
}

void GaggiMateController::sendSensorData() {
    const float pumpPower = *pump->getPumpPowerPtr();
    const float heaterPower = heater ? heater->getDutyCycle() : 0.0f;
    float puckFlow = 0.0f;
    float pumpFlow = 0.0f;
    float puckResistance = 0.0f;
    float pressure = 0.0f;
    float waterPumped = 0.0f;
    gm::Payload batch[2];
    size_t n = 0;
    if (_config.capabilites.pressure) {
        pressure = pressureSensor->getPressure();
        if (_config.capabilites.dimming) {
            auto dimmedPump = static_cast<DimmedPump *>(pump.get());
            puckFlow = dimmedPump->getPuckFlow();
            pumpFlow = dimmedPump->getPumpFlow();
            puckResistance = dimmedPump->getPuckResistance();
            waterPumped = dimmedPump->getPumpedWater();
            if (this->valve->getState()) {
                batch[n++] = _comms.buildVolumetricMeasurement(dimmedPump->getCoffeeVolume());
            }
        }
    }
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_sensor_tag;
    p.content.sensor.has_tank_level = tankLevel != nullptr;
    p.content.sensor.has_steam_boiler_low = waterSense != nullptr && steamLevelKnown.load();
    p.content.sensor.steam_boiler_low = steamLevelLow.load();
    p.content.sensor.tank_level_ok = tankLevelOK;
    p.content.sensor.boilers_count = _config.capabilites.dualBoiler ? 2 : 1; // boiler 0; schema allows more
    p.content.sensor.boilers[0].index = 0;
    p.content.sensor.boilers[0].temperature = this->brewTemperature->read();
    p.content.sensor.boilers[0].pressure = pressure;
    p.content.sensor.boilers[0].power = heaterPower;
    if (_config.capabilites.dualBoiler) {
        p.content.sensor.boilers[1].index = 1;
        p.content.sensor.boilers[1].temperature = this->steamTemperature->read();
        p.content.sensor.boilers[1].pressure = 0.0f;
    }
    p.content.sensor.puck_flow = puckFlow;
    p.content.sensor.pump_flow = pumpFlow;
    p.content.sensor.puck_resistance = puckResistance;
    p.content.sensor.pump_power = pumpPower;
    p.content.sensor.water_pumped = waterPumped;
    batch[n++] = p;
    _comms.sendUnreliableBatch(batch, n);
}

void GaggiMateController::loadMachineHardware() {
    machineHardware = defaultMachineHardware();
    Preferences prefs;
    if (prefs.begin("machine-hw", true)) {
        uint8_t bytes[sizeof(gm::MachineHardwareSettings) + 2 * sizeof(uint32_t)]{};
        const size_t size = prefs.getBytesLength("config");
        gm::MachineHardwareSettings stored = gaggimate_MachineHardwareSettings_init_zero;
        if (size <= sizeof(bytes) && prefs.getBytes("config", bytes, size) == size &&
            decodeStoredMachineHardware(bytes, size, stored)) {
            machineHardware = stored;
            hardwareConfigurationStored = size == sizeof(stored);
        }
        prefs.end();
    }
}

void GaggiMateController::storeMachineHardware(const gm::MachineHardwareSettings &settings) {
    if (!_config.capabilites.dualBoiler)
        return;
    if (!validMachineHardware(settings)) {
        hardwareConfigurationError = true;
        return;
    }
    const bool changed = machineHardwareHash(settings) != machineHardwareHash(machineHardware);
    if (changed) {
        hardwareConfigurationAccepted = false;
        hardwareSessionReady = false;
        heater->setSetpoint(0);
        heater->stop();
        heater2->setSetpoint(0);
        heater2->stop();
        pump->setPower(0);
        refill->set(false);
    }
    if (changed || !hardwareConfigurationStored) {
        auto stored = settings;
        stored.restart_if_required = false;
        Preferences prefs;
        if (!prefs.begin("machine-hw", false)) {
            hardwareConfigurationError = true;
            return;
        }
        const bool saved = prefs.putBytes("config", &stored, sizeof(stored)) == sizeof(stored);
        prefs.end();
        if (!saved) {
            hardwareConfigurationError = true;
            return;
        }
        hardwareConfigurationStored = true;
        ESP_LOGI("MachineHardware", "Saved configuration hash=%lu, structural=%d", (unsigned long)machineHardwareHash(settings),
                 changed);
    }
    hardwareConfigurationError = false;
    if (changed) {
        if (settings.restart_if_required) {
            delay(300);
            ESP.restart();
        }
        return;
    }
    machineHardware = settings;
    hardwareConfigurationAccepted = true;
    // Configuration remains writable while faulted; applying corrected NTC parameters
    // restarts the controller. Sensor readiness does not suppress fault reporting.
    hardwareSessionReady = hardwareSessionReady || (!brewTemperature->isErrorState() && !steamTemperature->isErrorState());
}

void GaggiMateController::handleSerialCommand(char c) {
    if (c == 'S') {
        ESP_LOGI("Controller", "");
        ESP_LOGI("Controller", "╔════════════════╗");
        ESP_LOGI("Controller", "║ Status Summary ║");
        ESP_LOGI("Controller", "╠════════════════╝");
        ESP_LOGI("Controller", "║");
        ESP_LOGI("Controller", "╠═ Error codes");
        ESP_LOGI("Controller", "║  ├─ Controller Error: %d", errorState);
        ESP_LOGI("Controller", "║  └─ Thermocouple Error: %d", brewTemperature->isErrorState());
        ESP_LOGI("Controller", "║");
        ESP_LOGI("Controller", "╠═ Readings");
        if (_config.capabilites.pressure) {
            auto dimmedPump = static_cast<DimmedPump *>(pump.get());
            ESP_LOGI("Controller", "║  ├─ Pressure: %.2f", pressureSensor->getPressure());
            ESP_LOGI("Controller", "║  ├─ Flow: %.2f", dimmedPump->getPumpFlow());
            ESP_LOGI("Controller", "║  ├─ Pump Power: %.2f", dimmedPump->getPowerTarget());
        }
        if (_config.capabilites.dualBoiler) {
            ESP_LOGI("Controller", "║  ├─ Steam Boiler Low: %.2f", waterSense ? waterSense->getState() : false);
            ESP_LOGI("Controller", "║  ├─ Temperature2: %.2f", steamTemperature->read());
        }
        ESP_LOGI("Controller", "║  └─ Temperature: %.2f", brewTemperature->read());
        ESP_LOGI("Controller", "║");
        ESP_LOGI("Controller", "╠═ Control");
        if (_config.capabilites.dualBoiler) {
            ESP_LOGI("Controller", "║  ├─ Refill: %d", refill->getState());
            ESP_LOGI("Controller", "║  ├─ Aux: %d", aux->getState());
            ESP_LOGI("Controller", "║  ├─ Steam Temperature: %d", heater2->getSetpoint());
        }
        if (_config.capabilites.pressure) {
            auto dimmedPump = static_cast<DimmedPump *>(pump.get());
            ESP_LOGI("Controller", "║  ├─ Pressure: %.2f", dimmedPump->getPressureTarget());
            ESP_LOGI("Controller", "║  ├─ Flow: %.2f", dimmedPump->getFlowTarget());
            ESP_LOGI("Controller", "║  ├─ Pump Power: %.2f", dimmedPump->getPowerTarget());
            ESP_LOGI("Controller", "║  ├─ Pump Power: %.2f", dimmedPump->getPowerTarget());
        }
        ESP_LOGI("Controller", "║  └─ Temperature: %.2f", heater->getSetpoint());
        ESP_LOGI("Controller", "║");

        size_t free = heap_caps_get_free_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
        size_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
        size_t total = heap_caps_get_total_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
        float fragmentation = 100 - (largest * 100) / free;
        ESP_LOGI("Controller", "╠═ Memory");
        ESP_LOGI("Controller", "║  ├─ Heap: %d / %d (%.2f%%)", (total - free), total, (100.0f * (total - free)) / total);
        ESP_LOGI("Controller", "║  └─ Fragmentation: %.2f%%", fragmentation);
        ESP_LOGI("Controller", "");
    } else {
        ESP_LOGI("Controller", "Unrecognized Input! Available commands: S (Status)");
    }
}
