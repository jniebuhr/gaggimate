#include "GaggiMateController.h"
#include <Arduino.h>
#include <SPI.h>

GaggiMateController::GaggiMateController() {
    this->pid = new PID(&this->input, &this->output, &this->setpoint, 0, 0, 0, DIRECT);
    this->pidAutotune = new PID_ATune(&this->input, &this->output);
    configs.push_back(GM_STANDARD_REV_1X);
    configs.push_back(GM_STANDARD_REV_2X);
    configs.push_back(GM_PRO_REV_1x);
}

void GaggiMateController::setup() {
    detectBoard();
    detectAddon();
    this->max31855 = new MAX31855(_config.maxCsPin, _config.maxMisoPin, _config.maxSckPin);
    // Initialize UART and Protobuf communication
    _ble.initServer();

    // Initialize PID controller
    pid->SetMode(AUTOMATIC);
    pid->SetOutputLimits(0, 255);

    printf("Initializing SPI\n");
    SPI.begin();
    pinMode(_config.maxCsPin, OUTPUT);
    digitalWrite(_config.maxCsPin, HIGH);

    max31855->begin();
    max31855->setSPIspeed(1000000);

    // Initialize last ping time
    lastPingTime = millis();

    // Initialize GPIOs
    pinMode(_config.heaterPin, OUTPUT);
    pinMode(_config.pumpPin, OUTPUT);
    pinMode(_config.valvePin, OUTPUT);
    pinMode(_config.altPin, OUTPUT);
    pinMode(_config.brewButtonPin, INPUT_PULLUP);
    pinMode(_config.steamButtonPin, INPUT_PULLUP);

    controlHeater(0);
    controlPump();
    controlAlt(false);
    controlValve(false);

    pidAutotune->SetOutputStep(10);  // Set the output step size for autotuning
    pidAutotune->SetControlType(1);  // Set to 1 for temperature control
    pidAutotune->SetNoiseBand(1.0);  // Set the noise band
    pidAutotune->SetLookbackSec(10); // Set the lookback time

    _ble.registerTempControlCallback([this](float temperature) { this->onTemperatureControl(temperature); });
    _ble.registerPumpControlCallback([this](float setpoint) { this->onPumpControl(setpoint); });
    _ble.registerValveControlCallback([this](bool state) { this->controlValve(state); });
    _ble.registerAltControlCallback([this](bool state) { this->controlAlt(state); });
    _ble.registerPidControlCallback([this](float Kp, float Ki, float Kd) { this->pid->SetTunings(Kp, Ki, Kd); });
    _ble.registerPingCallback([this]() {
        lastPingTime = millis();
        printf("Ping received, system is alive.\n");
    });
    _ble.registerAutotuneCallback([this]() {
        isAutotuning = true;
        printf("Starting autotune\n");
    });

    lastCycleStart = millis();
    lastTempUpdate = millis();

    printf("Initialization done\n");
}

void GaggiMateController::loop() {
    while (true) {
        unsigned long now = millis();
        if ((now - lastPingTime) / 1000 > PING_TIMEOUT_SECONDS) {
            handlePingTimeout();
        }
        if (setpoint > 0 || isAutotuning) {
            if (!isAutotuning) {
                pid->Compute();
            } else if (pidAutotune->Runtime() < 0) {
                printf("Finished autotune: %f, %f, %f\n", pidAutotune->GetKp(), pidAutotune->GetKi(), pidAutotune->GetKd());
                pid->SetTunings(pidAutotune->GetKp(), pidAutotune->GetKi(), pidAutotune->GetKd());
                stopPidAutotune();
            }
            controlHeater(static_cast<int>(output));
        } else {
            controlHeater(0);
        }

        if (input > MAX_SAFE_TEMP) {
            thermalRunawayShutdown();
        }

        if (lastTempUpdate + TEMP_UPDATE_INTERVAL_MS < now) {
            input = readTemperature();
            _ble.sendTemperature(static_cast<float>(input));
            lastTempUpdate = millis();
        }

        printf("Temperature: %f\n", input);

        controlPump();

        if (digitalRead(_config.brewButtonPin) != brewButtonState) {
            brewButtonState = digitalRead(_config.brewButtonPin);
            _ble.sendBrewBtnState(!brewButtonState);
        }
        if (digitalRead(_config.steamButtonPin) != steamButtonState) {
            steamButtonState = digitalRead(_config.steamButtonPin);
            _ble.sendSteamBtnState(!steamButtonState);
        }

        delay(50);
    }
}

void GaggiMateController::registerBoardConfig(ControllerConfig config) { configs.push_back(config); }

void GaggiMateController::detectBoard() {
    pinMode(DETECT_EN_PIN, OUTPUT);
    pinMode(DETECT_VALUE_PIN, INPUT_PULLDOWN);
    digitalWrite(DETECT_EN_PIN, HIGH);
    uint16_t millivolts = analogReadMilliVolts(DETECT_VALUE_PIN);
    digitalWrite(DETECT_EN_PIN, LOW);
    int boardId = round(((float)millivolts) / 100.0f);
    printf("Detected Board ID: %d\n", boardId);
    for (ControllerConfig config : configs) {
        if (config.autodetectValue == boardId) {
            _config = config;
            printf("Using Board: %s\n", _config.name.c_str());
            return;
        }
    }
    printf("No compatible board detected.\n");
    delay(5000);
    ESP.restart();
}

void GaggiMateController::detectAddon() {
    // TODO: Add I2C scanning for extensions
}

void GaggiMateController::onTemperatureControl(float temperature) {
    if (isAutotuning) {
        // Ignore temperature control commands during autotuning
        return;
    }
    setpoint = temperature;
    printf("Setpoint updated to: %f\n", setpoint);
}

void GaggiMateController::onPumpControl(const float flow) {
    flowPercentage = flow;
    controlPump();
}

void GaggiMateController::handlePingTimeout() {
    if (setpoint == 0.0) {
        return;
    }
    printf("Ping timeout detected. Turning off heater and pump for safety.\n");
    // Turn off the heater and pump as a safety measure
    controlHeater(0);
    onPumpControl(0);
    controlValve(false);
    controlAlt(false);
    setpoint = 0;
    _ble.sendError(ERROR_CODE_TIMEOUT);
}

void GaggiMateController::thermalRunawayShutdown() {
    printf("Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    controlHeater(0);
    onPumpControl(0);
    controlValve(false);
    controlAlt(false);
    setpoint = 0;
    _ble.sendError(ERROR_CODE_RUNAWAY);
}

void GaggiMateController::controlHeater(int out) { analogWrite(_config.heaterPin, out); }

void GaggiMateController::controlPump() {
    unsigned long currentMillis = millis();

    // Reset the cycle every PUMP_CYCLE_DURATION milliseconds
    if (currentMillis - lastCycleStart >= static_cast<long>(PUMP_CYCLE_TIME)) {
        lastCycleStart = currentMillis;
    }

    // Calculate the time the pump should stay on for
    unsigned long onTime = static_cast<long>(flowPercentage * PUMP_CYCLE_TIME / 100.0f);

    // Determine the current step in the cycle
    unsigned long currentCycleDuration = (currentMillis - lastCycleStart);

    // Turn pump ON for the first `onSteps` steps and OFF for the remainder
    if (currentCycleDuration < onTime) {
        digitalWrite(_config.pumpPin, _config.pumpOn); // Relay on
    } else {
        digitalWrite(_config.pumpPin, !_config.pumpOn); // Relay off
    }
}

void GaggiMateController::controlValve(bool state) {
    if (state) {
        // Turn on the valve
        digitalWrite(_config.valvePin, _config.valveOn);
        printf("Setting valve relay to ON\n");
    } else {
        // Turn off the valve
        digitalWrite(_config.valvePin, !_config.valveOn);
        printf("Setting valve relay to OFF\n");
    }
}

void GaggiMateController::controlAlt(bool state) {
    if (state) {
        // Turn on the valve
        digitalWrite(_config.altPin, _config.altOn);
        printf("Setting ALT relay to ON\n");
    } else {
        // Turn off the valve
        digitalWrite(_config.altPin, !_config.altOn);
        printf("Setting ALT relay to OFF\n");
    }
}

float GaggiMateController::readTemperature() {
    int status = max31855->read();
    if (status == STATUS_OK) {
        return max31855->getTemperature();
    }
    printf("Error reading temperature: %d\n", status);
    return 0;
}

void GaggiMateController::stopPidAutotune() {
    isAutotuning = false;
    pidAutotune->Cancel();
    printf("PID autotune stopped.\n");
}
