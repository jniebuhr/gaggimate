#include "DistanceSensor.h"

static constexpr uint8_t TOF_ADDRESS = 0x7E;
static constexpr uint8_t TOF_MODEL_ID = 0xEE;
static constexpr uint16_t TOF_IO_TIMEOUT_MS = 200;
static constexpr uint16_t TOF_INVALID_RANGE = 0xFFFF;
static constexpr uint8_t MAX_FAILURES = 3;
static constexpr uint8_t MAX_STALE_READS = 4;
static constexpr uint8_t IDENTITY_CHECK_POLLS = 20;
static constexpr unsigned long RECOVERY_BACKOFF_MIN_MS = 5000;
static constexpr unsigned long RECOVERY_BACKOFF_MAX_MS = 60000;

DistanceSensor::DistanceSensor(SoftWireBus *bus, distance_callback_t callback) : bus(bus), _callback(callback) {
    this->tof = new VL53L0X(bus->wire());
}

void DistanceSensor::setup() {
    {
        SoftWireBus::Guard guard(bus);
        healthy = guard && initSensor();
    }
    if (!healthy) {
        ESP_LOGE("DistanceSensor", "Failed to initialize VL53L0X, will keep retrying");
        lastRecovery = millis();
        recoveryBackoff = RECOVERY_BACKOFF_MIN_MS;
    } else {
        ESP_LOGI("DistanceSensor", "Initialized VL53L0X");
    }
    xTaskCreate(loopTask, "DistanceSensor::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

bool DistanceSensor::initSensor() {
    // A sensor that kept power is still on TOF_ADDRESS; the write to the default address then just NACKs.
    this->tof->setAddress(TOF_ADDRESS);
    this->tof->setTimeout(TOF_IO_TIMEOUT_MS);
    if (!this->tof->init()) {
        return false;
    }
    this->tof->startContinuous(250);
    return this->tof->last_status == 0;
}

// Non-blocking poll so the bus lock is only held for a few ms.
bool DistanceSensor::readRange(uint16_t &range) {
    SoftWireBus::Guard guard(bus);
    if (!guard) {
        return false;
    }
    uint8_t status = tof->readReg(VL53L0X::RESULT_INTERRUPT_STATUS);
    if (tof->last_status != 0) {
        failures++;
        return false;
    }
    if ((status & 0x07) == 0) {
        if (++staleReads >= MAX_STALE_READS) {
            ESP_LOGW("DistanceSensor", "ToF stopped ranging");
            failures = MAX_FAILURES;
        }
        return false;
    }
    staleReads = 0;
    range = tof->readReg16Bit(VL53L0X::RESULT_RANGE_STATUS + 10);
    bool ok = tof->last_status == 0 && range != TOF_INVALID_RANGE;
    tof->writeReg(VL53L0X::SYSTEM_INTERRUPT_CLEAR, 0x01);
    ok = ok && tof->last_status == 0;
    if (ok && ++pollsSinceIdentityCheck >= IDENTITY_CHECK_POLLS) {
        pollsSinceIdentityCheck = 0;
        ok = checkIdentity();
    }
    if (!ok) {
        failures++;
        return false;
    }
    failures = 0;
    return true;
}

bool DistanceSensor::checkIdentity() {
    uint8_t model = tof->readReg(VL53L0X::IDENTIFICATION_MODEL_ID);
    if (tof->last_status != 0 || model != TOF_MODEL_ID) {
        ESP_LOGW("DistanceSensor", "ToF identity check failed (status=%u, id=0x%02X)", tof->last_status, model);
        return false;
    }
    return true;
}

void DistanceSensor::recover() {
    lastRecovery = millis();
    SoftWireBus::Guard guard(bus, 1000);
    if (guard) {
        ESP_LOGW("DistanceSensor", "Restarting ToF communication");
        bus->clear();
        tof->softReset();
        healthy = initSensor();
    }
    if (healthy) {
        ESP_LOGI("DistanceSensor", "ToF recovered");
        failures = 0;
        staleReads = 0;
        pollsSinceIdentityCheck = 0;
        measurements = 0;
        currentMillis = 0;
    } else {
        recoveryBackoff = recoveryBackoff == 0 ? RECOVERY_BACKOFF_MIN_MS : min(recoveryBackoff * 2, RECOVERY_BACKOFF_MAX_MS);
        ESP_LOGE("DistanceSensor", "ToF recovery failed, retrying in %lu ms", recoveryBackoff);
    }
}

void DistanceSensor::loop() {
    if (!healthy) {
        if (millis() - lastRecovery >= recoveryBackoff) {
            recover();
        }
        return;
    }
    uint16_t range = 0;
    if (!readRange(range)) {
        if (failures >= MAX_FAILURES) {
            ESP_LOGE("DistanceSensor", "ToF communication lost");
            healthy = false;
            // Recover right away unless we only just did, to avoid flapping.
            recoveryBackoff = millis() - lastRecovery > RECOVERY_BACKOFF_MAX_MS ? 0 : RECOVERY_BACKOFF_MIN_MS;
        }
        return;
    }
    int distance = range;
    currentMillis = currentMillis == 0 ? distance : static_cast<int>(currentMillis * 0.9 + static_cast<double>(distance) * 0.1);
    measurements = (measurements + 1) % 10;
    if (measurements == 0) {
        _callback(currentMillis);
    }
    ESP_LOGV("DistanceSensor", "Received measurement: %d", currentMillis);
}

void DistanceSensor::loopTask(void *arg) {
    auto *sensor = static_cast<DistanceSensor *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        sensor->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(500));
    }
}
