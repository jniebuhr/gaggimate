#include "main.h"
#include "PID_AutoTune_v0.h"
#include "PID_v1.h"
#include <MAX31855.h>

// PID variables
double setpoint = 0.0;
double input = 0.0;
double output = 0.0;
PID myPID(&input, &output, &setpoint, 0, 0, 0, DIRECT);
PID_ATune aTune(&input, &output);
MAX31855 thermoCouple(MAX6675_CS_PIN, MAX6675_MISO_PIN, MAX6675_SCK_PIN);

// System control variables
constexpr double MAX_SAFE_TEMP = 170.0;       // Max temperature for thermal runaway protection
constexpr double PING_TIMEOUT_SECONDS = 10.0; // Timeout for ping
long last_ping_time;                          // Last time a ping was received
bool is_autotuning = false;                   // Flag for whether we are in autotune mode
unsigned long lastCycleStart = 0;             // Tracks the start time of the pump cycle
float flowPercentage = 0;                     // Declare flowPercentage with an initial value
unsigned long lastTempUpdate = 0;
bool brew_button_state = true;
bool steam_button_state = true;

NimBLEServerController serverController;

void setup() {
    Serial.begin(115200);

    // Initialize UART and Protobuf communication
    serverController.initServer();

    // Initialize PID controller
    myPID.SetMode(AUTOMATIC);
    myPID.SetOutputLimits(0, 255); // Example output limits for heater control

    thermoCouple.begin();
    thermoCouple.setSPIspeed(1000000);

    // Register callbacks for message processing

    // Initialize last ping time
    last_ping_time = millis();

    printf("Initializing SPI\n");
    SPI.begin();
    pinMode(MAX6675_CS_PIN, OUTPUT);
    digitalWrite(MAX6675_CS_PIN, HIGH); // Ensure CS is high

    // Initialize heater and pump GPIOs (set to LOW/OFF state)
    pinMode(HEATER_PIN, OUTPUT);
    pinMode(PUMP_PIN, OUTPUT);
    pinMode(VALVE_PIN, OUTPUT);
    pinMode(ALT_PIN, OUTPUT);
    control_heater(0);
    control_pump();
    control_alt(false);
    control_valve(false);

    // brew switch input
    pinMode(BREW_PIN, INPUT_PULLUP);
    // steam switch input
    pinMode(STEAM_PIN, INPUT_PULLUP);

    aTune.SetOutputStep(10);  // Set the output step size for autotuning
    aTune.SetControlType(1);  // Set to 1 for temperature control
    aTune.SetNoiseBand(1.0);  // Set the noise band
    aTune.SetLookbackSec(10); // Set the lookback time

    serverController.registerTempControlCallback(on_temperature_control);
    serverController.registerPumpControlCallback(on_pump_control);
    serverController.registerValveControlCallback(on_valve_control);
    serverController.registerAltControlCallback(on_alt_control);
    serverController.registerPidControlCallback(on_pid_control);
    serverController.registerPingCallback(on_ping);
    serverController.registerAutotuneCallback(on_autotune);
    lastCycleStart = millis();
    lastTempUpdate = millis();

    printf("Initialization done\n");
}

void loop() {
    while (true) {
        unsigned long now = millis();
        if ((now - last_ping_time) / 1000 > PING_TIMEOUT_SECONDS) {
            handle_ping_timeout();
        }
        if (setpoint > 0 || is_autotuning) {
            if (!is_autotuning) {
                myPID.Compute();
            } else if (aTune.Runtime() < 0) {
                printf("Finished autotune: %f, %f, %f\n", aTune.GetKp(), aTune.GetKi(), aTune.GetKd());
                myPID.SetTunings(aTune.GetKp(), aTune.GetKi(), aTune.GetKd());
                stop_pid_autotune();
            }
            control_heater(static_cast<int>(output));
        } else {
            control_heater(0);
        }

        if (input > MAX_SAFE_TEMP) {
            thermal_runaway_shutdown();
        }

        if (lastTempUpdate + TEMP_UPDATE_INTERVAL_MS < now) {
            input = read_temperature();
            serverController.sendTemperature(static_cast<float>(input));
            lastTempUpdate = millis();
        }

        printf("Temperature: %f\n", input);

        control_pump();

        if (digitalRead(BREW_PIN) != brew_button_state) {
            brew_button_state = digitalRead(BREW_PIN);
            serverController.sendBrewBtnState(!brew_button_state);
        }
        if (digitalRead(STEAM_PIN) != steam_button_state) {
            steam_button_state = digitalRead(STEAM_PIN);
            serverController.sendSteamBtnState(!steam_button_state);
        }

        delay(50);
    }
}

void on_temperature_control(float temperature) {
    if (is_autotuning) {
        // Ignore temperature control commands during autotuning
        return;
    }
    setpoint = temperature;
    printf("Setpoint updated to: %f\n", setpoint);
}

void on_pump_control(const float flow) {
    flowPercentage = flow;
    control_pump();
}

void on_valve_control(bool state) { control_valve(state); }

void on_alt_control(bool state) { control_alt(state); }

void on_pid_control(float Kp, float Ki, float Kd) { myPID.SetTunings(Kp, Ki, Kd); }

void on_ping() {
    // Update the last ping time
    last_ping_time = millis();
    printf("Ping received, system is alive.\n");
}

void handle_ping_timeout() {
    if (setpoint == 0.0) {
        return;
    }
    printf("Ping timeout detected. Turning off heater and pump for safety.\n");
    // Turn off the heater and pump as a safety measure
    control_heater(0);
    on_pump_control(0);
    control_valve(false);
    control_alt(false);
    setpoint = 0;
    serverController.sendError(ERROR_CODE_TIMEOUT);
}

void thermal_runaway_shutdown() {
    printf("Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    control_heater(0);
    on_pump_control(0);
    control_valve(false);
    control_alt(false);
    setpoint = 0;
    serverController.sendError(ERROR_CODE_RUNAWAY);
}

void control_heater(int out) { analogWrite(HEATER_PIN, out); }

void control_pump() {
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
        digitalWrite(PUMP_PIN, RELAY_ON); // Relay on
    } else {
        digitalWrite(PUMP_PIN, !RELAY_ON); // Relay off
    }
}

void control_valve(bool state) {
    if (state) {
        // Turn on the valve
        digitalWrite(VALVE_PIN, RELAY_ON);
        printf("Setting valve relay to ON\n");
    } else {
        // Turn off the valve
        digitalWrite(VALVE_PIN, !RELAY_ON);
        printf("Setting valve relay to OFF\n");
    }
}

void control_alt(bool state) {
    if (state) {
        // Turn on the valve
        digitalWrite(ALT_PIN, RELAY_ON);
        printf("Setting ALT relay to ON\n");
    } else {
        // Turn off the valve
        digitalWrite(ALT_PIN, !RELAY_ON);
        printf("Setting ALT relay to OFF\n");
    }
}

float read_temperature() {
    int status = thermoCouple.read();
    if (status == STATUS_OK) {
        return thermoCouple.getTemperature();
    }
    printf("Error reading temperature: %d\n", status);
    return 0;
}

void on_autotune() {
    is_autotuning = true;
    printf("Starting PID autotune...\n");
}

void stop_pid_autotune() {
    is_autotuning = false;
    aTune.Cancel();
    printf("PID autotune stopped.\n");
}
