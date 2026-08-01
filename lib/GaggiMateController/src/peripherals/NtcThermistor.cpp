#include "NtcThermistor.h"
#include <Arduino.h>
#include <SPI.h>
#include <freertos/FreeRTOS.h>

NtcThermistor::NtcThermistor(ADSAdc *adc, uint8_t channel, const temperature_error_callback_t &error_callback)
    : taskHandle(nullptr), _adc(adc), _channel(channel) {
    this->error_callback = error_callback;
}

float NtcThermistor::read() { return isErrorState() ? 0.0f : temperature; }

bool NtcThermistor::isErrorState() { return temperature <= 0 || errorCount >= NTC_MAX_ERRORS; }

void NtcThermistor::setup() {
    xTaskCreate(monitorTask, "NtcThermocouple::monitor", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void NtcThermistor::loop() {
    if (errorCount >= NTC_MAX_ERRORS || temperature > MAX_SAFE_TEMP) {
        ESP_LOGE(LOG_TAG, "NTCThermistor failure! Error Count: %d, Temperature: %.2f\n", errorCount, temperature);
        error_callback();
        return;
    }
    // If buffer has been filled up, remove the previous result from the error count
    if (resultCount == NTC_ERROR_WINDOW) {
        errorCount -= resultBuffer[bufferIndex];
    } else {
        ++resultCount;
    }

    int reading = _adc->getValue(_channel);
    float Va = reading * ADC_STEP;
    float Rt = Rs * Va / (Vs - Va);
    float T = 1 / (1 / To + log(Rt / Ro) / Beta);
    float temp = T - 273.15;

    ESP_LOGI(LOG_TAG, "NTCThermistor: reading: %d, Va: %.2f, Rt: %.2f, T: %.2f", reading, Va, Rt, T);

    if (temp <= 0.0f) {
        ESP_LOGE(LOG_TAG, "Temperature reported below 0°C: %.2f\n", temp);
    }

    resultBuffer[bufferIndex] = temp <= 0.0f ? 1 : 0;
    errorCount += resultBuffer[bufferIndex];
    bufferIndex = (bufferIndex + 1) % NTC_ERROR_WINDOW;

    if (temp <= 0.0f)
        return;
    temperature = 0.2f * temp + 0.8f * temperature;
    ESP_LOGI(LOG_TAG, "Updated temperature: %2f\n", temperature);
}

[[noreturn]] void NtcThermistor::monitorTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *thermocouple = static_cast<NtcThermistor *>(arg);
    while (true) {
        thermocouple->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(NTC_UPDATE_INTERVAL));
    }
}
