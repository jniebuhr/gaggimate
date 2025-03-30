#include "PressureSensor.h"
#include "Wire.h"

PressureSensor::PressureSensor(uint8_t sda_pin, uint8_t scl_pin, const pressure_callback_t &callback, float pressure_range,
                               float voltage_floor, float voltage_ceil)
    : _sda_pin(sda_pin), _scl_pin(scl_pin), _pressure_range(pressure_range), _callback(callback), taskHandle(nullptr) {
    _adc_floor = static_cast<int16_t>(voltage_floor / ADC_STEP);
    float pressureAdcRange = (voltage_ceil - voltage_floor) / ADC_STEP;
    _pressure_step = pressure_range / pressureAdcRange;
}

void PressureSensor::setup() {
    Wire1.begin(_sda_pin, _scl_pin);
    ESP_LOGI(LOG_TAG, "Initializing pressure sensor on SDA: %d, SCL: %d", _sda_pin, _scl_pin);
    delay(100);
    ads = new ADS1115(0x48, &Wire1);
    if (!ads->begin()) {
        ESP_LOGE(LOG_TAG, "Failed to initialize ADS1115");
    }
    ads->setGain(0);
    ads->setDataRate(4);
    ads->setMode(0);
    ads->readADC(0);
    xTaskCreate(loopTask, "Heater::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void PressureSensor::loop() {
    if (ads->isConnected()) {
        int16_t reading = ads->readADC();
        // Subtract the voltage floor from the reading in case of a 0.5-4.5V sensor
        reading = reading - _adc_floor;
        float pressure = reading * _pressure_step;
        ESP_LOGV(LOG_TAG, "ADC Reading: %d, Pressure Reading: %f, Pressure Step: %f, Floor: %d", reading, pressure,
                 _pressure_step, _adc_floor);
        _callback(pressure);
    }
}

[[noreturn]] void PressureSensor::loopTask(void *arg) {
    auto *sensor = static_cast<PressureSensor *>(arg);
    while (true) {
        sensor->loop();
        vTaskDelay(PRESSURE_READ_INTERVAL_MS / portTICK_PERIOD_MS);
    }
}
