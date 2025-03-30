#include "DimmedPump.h"

DimmedPump::DimmedPump(uint8_t ssr_pin, uint8_t sense_pin)
    : _ssr_pin(ssr_pin), _sense_pin(sense_pin), _psm(_sense_pin, _ssr_pin, 100, FALLING, 1, 6) {
    _psm.set(0);
}

void DimmedPump::setup() {
    xTaskCreate(loopTask, "DimmedPump::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DimmedPump::loop() { }

void DimmedPump::setPower(float setpoint) {
    ESP_LOGI(LOG_TAG, "Setting power to %2f", setpoint);
    _power = setpoint;
    _psm.set(static_cast<int>(setpoint));
}

void DimmedPump::loopTask(void *arg) {
    auto *pump = static_cast<DimmedPump *>(arg);
    while (true) {
        pump->loop();
        vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
}
