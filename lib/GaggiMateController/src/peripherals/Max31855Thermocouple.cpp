#include "Max31855Thermocouple.h"
#include <Arduino.h>
#include <SPI.h>
#include <freertos/FreeRTOS.h>

Max31855Thermocouple::Max31855Thermocouple(const int csPin, const int misoPin, const int sckPin,
                                           const temperature_callback_t &callback,
                                           const temperature_error_callback_t &error_callback)
    : taskHandle(nullptr), csPin(csPin), misoPin(misoPin), sckPin(sckPin) {
    max31855 = new MAX31855(csPin, misoPin, sckPin);
    this->callback = callback;
    this->error_callback = error_callback;
}

float Max31855Thermocouple::read() { return temperature; }

bool Max31855Thermocouple::hasError() { return errors >= MAX31855_MAX_ERRORS; }

void Max31855Thermocouple::setup() {
    SPI.begin();
    pinMode(csPin, OUTPUT);
    digitalWrite(csPin, HIGH);
    max31855->begin();
    max31855->setSPIspeed(1000000);

    xTaskCreate(monitorTask, "Max31855Thermocouple::monitor", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void Max31855Thermocouple::loop() {
    int status = max31855->read();
    if (status != STATUS_OK) {
        ESP_LOGE(LOG_TAG, "Failed to read temperature: %d\n", status);
        errors++;
    }
    errors = 0;
    float temp = max31855->getTemperature();
    if (temp > 0) {
        temperature = 0.2 * temp + 0.8 * temperature;
    } else {
        errors++;
    }
    if (errors >= MAX31855_MAX_ERRORS || temperature > MAX_SAFE_TEMP) {
        error_callback();
        return;
    }
    ESP_LOGV(LOG_TAG, "Updated temperature: %2f\n", temperature);
    callback(temperature);
}

[[noreturn]] void Max31855Thermocouple::monitorTask(void *arg) {
    auto *thermocouple = static_cast<Max31855Thermocouple *>(arg);
    while (true) {
        thermocouple->loop();
        vTaskDelay(MAX31855_UPDATE_INTERVAL / portTICK_PERIOD_MS);
    }
}
