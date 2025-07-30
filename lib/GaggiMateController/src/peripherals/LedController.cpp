#include "LedController.h"

LedController::LedController(TwoWire *i2c) { this->pca9634 = new PCA9634(0x00, i2c); }

void LedController::setup() {
    this->initialize();
    this->disable();
}

bool LedController::isAvailable() { return this->initialize(); }

void LedController::setChannel(uint8_t channel, uint8_t brightness) {
    this->pca9634->setLedDriverMode(channel, PCA963X_LEDPWM);
    this->pca9634->write1(channel, brightness);
}

void LedController::disable() { this->pca9634->setLedDriverModeAll(PCA963X_LEDOFF); }

bool LedController::initialize() {
    if (this->initialized) {
        return true;
    }
    bool retval = this->pca9634->begin();
    if (!retval) {
        ESP_LOGE("LedController", "Failed to initialize PCA9634");
    }
    this->initialized = retval;
    return retval;
}
