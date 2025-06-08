#include "PressureSensor.h"
#include "Wire.h"

PressureSensor::PressureSensor(uint8_t sda_pin, uint8_t scl_pin, const pressure_callback_t &callback, float pressure_scale,
                               float voltage_floor, float voltage_ceil)
    : _sda_pin(sda_pin), _scl_pin(scl_pin), _pressure_scale(pressure_scale), _callback(callback), taskHandle(nullptr) {
    _adc_floor = static_cast<int16_t>(voltage_floor / ADC_STEP);
    _pressure_adc_range = (voltage_ceil - voltage_floor) / ADC_STEP;
    _pressure_step = pressure_scale / _pressure_adc_range;
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
        reading = reading - _adc_floor;
        float pressure = reading * _pressure_step;
        _pressure = 0.05f * pressure + 0.95f * _pressure;
        _pressure = std::clamp(_pressure, 0.0f, _pressure_scale);
        ESP_LOGV(LOG_TAG, "ADC Reading: %d, Pressure Reading: %f, Pressure Step: %f, Floor: %d", reading, _pressure,
                 _pressure_step, _adc_floor);
        _callback(_pressure);
    }
}

void PressureSensor::setScale(float pressure_scale) {
    _pressure_scale = pressure_scale;
    _pressure_step = pressure_scale / _pressure_adc_range;
}

[[noreturn]] void PressureSensor::loopTask(void *arg) {
    auto *sensor = static_cast<PressureSensor *>(arg);
    while (true) {
        sensor->loop();
        vTaskDelay(PRESSURE_READ_INTERVAL_MS / portTICK_PERIOD_MS);
    }
}
