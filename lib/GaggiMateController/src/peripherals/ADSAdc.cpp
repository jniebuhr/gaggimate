#include "ADSAdc.h"
#include "Wire.h"

ADSAdc::ADSAdc(uint8_t sda_pin, uint8_t scl_pin, uint8_t numChannels)
    : _sda_pin(sda_pin), _scl_pin(scl_pin), _numChannels(numChannels), taskHandle(nullptr) {}

void ADSAdc::setup() {
    Wire1.begin(_sda_pin, _scl_pin);
    ESP_LOGV(LOG_TAG, "Initializing ADS1115 on SDA: %d, SCL: %d", _sda_pin, _scl_pin);
    delay(100);
    ads = new ADS1115(0x48, &Wire1);
    if (!ads->begin()) {
        ESP_LOGE(LOG_TAG, "Failed to initialize ADS1115");
    }
    ads->setGain(0);
    ads->setDataRate(7);
    ads->setMode(1);
    ads->requestADC(0);
    xTaskCreate(loopTask, "ADSAdc::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void ADSAdc::loop() {
    if (ads->isConnected() && ads->isReady()) {
        int reading = ads->getValue();
        _value[_currentChannel] = reading;
        _currentChannel = (_currentChannel + 1) % _numChannels;
        ads->requestADC(_currentChannel);
    }
}

[[noreturn]] void ADSAdc::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *sensor = static_cast<ADSAdc *>(arg);
    while (true) {
        sensor->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(ADC_READ_INTERVAL_MS));
    }
}
