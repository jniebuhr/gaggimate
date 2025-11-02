#include "LedController.h"

LedController::LedController(TwoWire *i2c) { this->pca9634 = new PCA9634(0x00, i2c); }

void LedController::setup() {
    this->initialize();
    this->disable();
}

bool LedController::isAvailable() { return this->initialize(); }

void LedController::setChannel(uint8_t channel, uint8_t brightness) {
    ESP_LOGI("LedController", "Setting channel %u to %u", channel, brightness);
    this->pca9634->write1(channel, brightness);
}

void LedController::disable() {
    this->pca9634->allOff();
    this->pca9634->write1(4, 0xFF);
    this->pca9634->write1(5, 0xFF);
}

bool LedController::initialize() {
    if (this->initialized) {
        return true;
    }
    bool retval = this->pca9634->begin();
    if (!retval) {
        ESP_LOGE("LedController", "Failed to initialize PCA9634");
    }
    ESP_LOGI("LedController", "Initialized PCA9634");
    this->initialized = retval;
    this->pca9634->setMode1(PCA963X_MODE1_NONE);
    this->pca9634->setMode2(PCA963X_MODE2_TOTEMPOLE);
    this->pca9634->allOff();
    this->pca9634->write1(4, 0xFF);
    this->pca9634->write1(5, 0xFF);
    this->pca9634->setLedDriverModeAll(PCA963X_LEDPWM);
    ESP_LOGI("LedController", "Mode1: %d", this->pca9634->getMode1());
    ESP_LOGI("LedController", "Mode2: %d", this->pca9634->getMode2());
    return retval;
}
