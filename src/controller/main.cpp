#include "main.h"

// PID variables
double setpoint = 0.0;                                        // Desired temperature
double input = 0.0;                                           // Current temperature input from the thermocouple
double output = 0.0;                                          // PID output to control heater
PID myPID(&input, &output, &setpoint, 2.0, 5.0, 1.0, DIRECT); // PID tuning parameters
PID_ATune aTune(&input, &output);                             // PID autotune instance

// System control variables
const double MAX_SAFE_TEMP = 150.0;       // Max temperature for thermal runaway protection
long last_ping_time;                      // Last time a ping was received
const double PING_TIMEOUT_SECONDS = 10.0; // Timeout for ping
bool is_autotuning = false;               // Flag for whether we are in autotune mode

NimBLEServerController serverController;

void setup() {
    Serial.begin(115200);
    // Initialize UART and Protobuf communication
    serverController.initServer();

    // Initialize PID controller
    myPID.SetMode(AUTOMATIC);
    myPID.SetOutputLimits(0, 255); // Example output limits for heater control

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
    control_heater(0);
    control_pump(false);
    control_valve(false);

    aTune.SetOutputStep(10);  // Set the output step size for autotuning
    aTune.SetControlType(1);  // Set to 1 for temperature control
    aTune.SetNoiseBand(1.0);  // Set the noise band
    aTune.SetLookbackSec(10); // Set the lookback time

    serverController.registerTempControlCallback(on_temperature_control);
    serverController.registerPumpControlCallback(on_pump_control);
    serverController.registerValveControlCallback(on_valve_control);
    serverController.registerPingCallback(on_ping);
    serverController.registerAutotuneCallback(on_autotune);

    printf("Initialization done\n");
}

void loop() {
    uint8_t buffer[64];
    while (1) {

        // Check the ping timeout for safety
        long now = millis();
        if ((now - last_ping_time) / 1000 > PING_TIMEOUT_SECONDS) {
            handle_ping_timeout();
        }

        input = read_temperature(); // Read the current boiler temperature

        // Handle PID control if system is active and not autotuning
        if (setpoint > 0 || is_autotuning) {

            if (is_autotuning) {
                // Execute autotuning
                if (aTune.Runtime() < 0) { // Check if tuning is complete
                    printf("Finished autotune: %f, %f, %f\n", aTune.GetKp(), aTune.GetKi(), aTune.GetKd());
                    myPID.SetTunings(aTune.GetKp(), aTune.GetKi(), aTune.GetKd());
                    stop_pid_autotune(); // Stop autotuning after completion
                }
            } else {
                myPID.Compute(); // Perform PID computation
            }
            control_heater(output); // Control the heater based on the PID output
        } else {
            control_heater(0);
        }

        // Check for thermal runaway
        if (input > MAX_SAFE_TEMP) {
            thermal_runaway_shutdown();
        }

        // Update UI with temperature
        serverController.sendTemperature(input);
        delay(250);
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

void on_pump_control(bool state) { control_pump(state); }

void on_valve_control(bool state) { control_valve(state); }

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
    control_pump(false);
    setpoint = 0;
    serverController.sendError(ERROR_CODE_TIMEOUT);
}

void thermal_runaway_shutdown() {
    printf("Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    control_heater(0);
    control_pump(false);
    setpoint = 0;
    serverController.sendError(ERROR_CODE_RUNAWAY);
}

void control_heater(int out) {
    analogWriteFrequency(PWM_FREQUENCY);
    analogWrite(HEATER_PIN, out);
    printf("Sending heater output: %d\n", out);
}

void control_pump(bool state) {
    if (state) {
        // Turn on the pump
        digitalWrite(PUMP_PIN, LOW);
        printf("Setting pump relay to ON\n");
    } else {
        // Turn off the pump
        digitalWrite(PUMP_PIN, HIGH);
        printf("Setting pump relay to OFF\n");
    }
}

void control_valve(bool state) {
    if (state) {
        // Turn on the valve
        digitalWrite(VALVE_PIN, LOW);
        printf("Setting valve relay to ON\n");
    } else {
        // Turn off the valve
        digitalWrite(VALVE_PIN, HIGH);
        printf("Setting valve relay to OFF\n");
    }
}

float read_temperature(void) {
    uint16_t v; // Variable to store the temperature value

    // Start communication with the MAX6675
    digitalWrite(MAX6675_CS_PIN, LOW); // Select the MAX6675
    delay(1);                          // Allow time for the chip to select

    // Read the 16-bit value from the MAX6675
    v = SPI.transfer(0x00) << 8;        // Read the first byte
    v |= SPI.transfer(0x00);            // Read the second byte
    digitalWrite(MAX6675_CS_PIN, HIGH); // Deselect the MAX6675

    // Check if the reading is valid
    if (v & 0x4) { // Check if the thermocouple is connected
        printf("Thermocouple not connected...\n");
        return -1; // Return an error value
    }

    // Shift the value right to get the temperature
    v >>= 3;                       // Remove the status bits
    float temperature = v * 0.25f; // Each unit corresponds to 0.25°C

    return temperature; // Return the temperature
}

void on_autotune() {
    is_autotuning = true;
    printf("Starting PID autotune...\n");
}

void stop_pid_autotune(void) {
    is_autotuning = false;
    aTune.Cancel();
    printf("PID autotune stopped.\n");
}
