#include "LedController.h"

LedController::LedController(SoftWireBus *bus) : bus(bus) { this->pca9634 = new PCA9634(0x00, bus->wire()); }

void LedController::setup() {
    this->initialize();
    this->disable();
}

bool LedController::isAvailable() { return this->initialize(); }

void LedController::setChannel(uint8_t channel, uint8_t brightness) {
    ESP_LOGI("LedController", "Setting channel %u to %u", channel, brightness);
    if (channel >= CHANNEL_COUNT) {
        return;
    }
    channels[channel] = brightness;
    if (allChannelsOff()) {
        this->disable();
        return;
    }
    SoftWireBus::Guard guard(bus);
    if (!guard) {
        ESP_LOGE("LedController", "Bus busy, channel %u deferred to next health check", channel);
        healthy = false;
        return;
    }
    bool ok = outputsEnabled ? this->writeChannel(channel) : this->applyEnabledState();
    if (!ok) {
        ESP_LOGE("LedController", "Error setting channel %u to %u: %d", channel, brightness, this->pca9634->lastError());
        this->recover();
    }
}

void LedController::disable() {
    SoftWireBus::Guard guard(bus);
    const uint8_t off[CHANNEL_COUNT] = {0, 0, 0, 0, 0xFF, 0xFF, 0, 0};
    memcpy(channels, off, sizeof(channels));
    outputsEnabled = false;
    if (!guard || !this->applyDisabledState()) {
        healthy = false;
    }
}

bool LedController::isChannelOff(uint8_t channel) const { return channels[channel] == (isHeldLowChannel(channel) ? 0xFF : 0); }

bool LedController::allChannelsOff() const {
    for (uint8_t i = 0; i < CHANNEL_COUNT; i++) {
        if (!isChannelOff(i)) {
            return false;
        }
    }
    return true;
}

// Channels 4/5 are held low via LEDON when off; PWM 0xFF would still leave a 1/256 high pulse.
bool LedController::writeChannel(uint8_t channel) {
    if (isHeldLowChannel(channel) && isChannelOff(channel)) {
        return this->pca9634->setLedDriverMode(channel, PCA963X_LEDON) == PCA963X_OK;
    }
    if (this->pca9634->write1(channel, channels[channel]) != PCA963X_OK) {
        return false;
    }
    return !isHeldLowChannel(channel) || this->pca9634->setLedDriverMode(channel, PCA963X_LEDPWM) == PCA963X_OK;
}

bool LedController::applyEnabledState() {
    outputsEnabled = true;
    bool ok = this->pca9634->setMode2(PCA963X_MODE2_TOTEMPOLE) == PCA963X_OK;
    ok = this->pca9634->writeAll(channels) == PCA963X_OK && ok;
    ok = this->pca9634->setLedDriverModeAll(PCA963X_LEDPWM) == PCA963X_OK && ok;
    for (uint8_t ch : {4, 5}) {
        if (isChannelOff(ch)) {
            ok = this->pca9634->setLedDriverMode(ch, PCA963X_LEDON) == PCA963X_OK && ok;
        }
    }
    return ok;
}

// Open drain: channels 0-3 float (LEDOFF), channels 4/5 are held low (LEDON).
bool LedController::applyDisabledState() {
    bool ok = this->pca9634->setMode2(PCA963X_MODE2_NONE) == PCA963X_OK;
    ok = this->pca9634->setLedDriverMode(4, PCA963X_LEDON) == PCA963X_OK && ok;
    ok = this->pca9634->setLedDriverMode(5, PCA963X_LEDON) == PCA963X_OK && ok;
    for (uint8_t ch = 0; ch < 4; ch++) {
        ok = this->pca9634->setLedDriverMode(ch, PCA963X_LEDOFF) == PCA963X_OK && ok;
    }
    return ok;
}

void LedController::healthCheck() {
    SoftWireBus::Guard guard(bus);
    if (!guard) {
        return;
    }
    uint8_t mode1 = this->pca9634->getMode1();
    bool ok = this->pca9634->lastError() == PCA963X_OK && (mode1 & PCA963X_MODE1_SLEEP) == 0;
    if (ok && healthy) {
        return;
    }
    if (healthy) {
        ESP_LOGW("LedController", "PCA9634 health check failed (mode1=0x%02X), restarting", mode1);
    }
    if (this->recover()) {
        ESP_LOGI("LedController", "PCA9634 recovered");
    }
}

// Caller must hold the bus lock.
bool LedController::recover() {
    bus->clear();
    initialized = false;
    healthy = this->initialize();
    return healthy;
}

bool LedController::initialize() {
    if (this->initialized) {
        return true;
    }
    SoftWireBus::Guard guard(bus);
    if (!guard) {
        return false;
    }
    bool retval = this->pca9634->begin();
    if (!retval) {
        if (healthy) {
            ESP_LOGE("LedController", "Failed to initialize PCA9634");
        }
        return false;
    }
    ESP_LOGI("LedController", "Initialized PCA9634");
    this->pca9634->setMode1(PCA963X_MODE1_NONE);
    // Restores the last commanded state; on first boot this is the disabled "off" pattern.
    retval = outputsEnabled ? this->applyEnabledState() : this->applyDisabledState();
    this->initialized = retval;
    ESP_LOGI("LedController", "Mode1: %d", this->pca9634->getMode1());
    ESP_LOGI("LedController", "Mode2: %d", this->pca9634->getMode2());
    return retval;
}
