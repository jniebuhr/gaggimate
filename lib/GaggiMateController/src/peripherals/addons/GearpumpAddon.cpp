#include "GearpumpAddon.h"
#include "GearpumpSharedIO.h"
#include <ExtensionIOXL9555.hpp>
#include <algorithm>
#include <cmath>

#define MCP_VOLTAGE 5.0f

static ExtensionIOXL9555 extension;
static GearpumpSharedIO *sharedIO = nullptr;

char swTxBuffer[128];
char swRxBuffer[128];

uint8_t read_scl(const SoftWire *i2c) {
    uint8_t value = sharedIO ? sharedIO->readPin(0) : extension.digitalRead(ExtensionIOXL9555::IO0);
    ESP_LOGV("MCP4725", "Read SCL: %d", value);
    return value;
}

uint8_t read_sda(const SoftWire *i2c) {
    uint8_t value = sharedIO ? sharedIO->readPin(1) : extension.digitalRead(ExtensionIOXL9555::IO1);
    ESP_LOGV("MCP4725", "Read SDA: %d", value);
    return value;
}

void scl_high(const SoftWire *i2c) {
    if (sharedIO) {
        sharedIO->setPin(0, true);
        return;
    }
    extension.pinMode(ExtensionIOXL9555::IO0, INPUT);
    ESP_LOGV("MCP4725", "Release SCL");
}

void sda_high(const SoftWire *i2c) {
    if (sharedIO) {
        sharedIO->setPin(1, true);
        return;
    }
    extension.pinMode(ExtensionIOXL9555::IO1, INPUT);
    ESP_LOGV("MCP4725", "Release SDA");
}

void scl_low(const SoftWire *i2c) {
    if (sharedIO) {
        sharedIO->setPin(0, false);
        return;
    }
    extension.pinMode(ExtensionIOXL9555::IO0, OUTPUT);
    extension.digitalWrite(ExtensionIOXL9555::IO0, LOW);
    ESP_LOGV("MCP4725", "Write SCL: %d", 0);
}

void sda_low(const SoftWire *i2c) {
    if (sharedIO) {
        sharedIO->setPin(1, false);
        return;
    }
    extension.pinMode(ExtensionIOXL9555::IO1, OUTPUT);
    extension.digitalWrite(ExtensionIOXL9555::IO1, LOW);
    ESP_LOGV("MCP4725", "Write SDA: %d", 0);
}

GearpumpAddon::GearpumpAddon(uint8_t addr, uint8_t sda, uint8_t scl, uint8_t interrupt, TwoWire *sharedBus)
    : _sharedBus(sharedBus), _addr(addr), _sda(sda), _scl(scl), _interrupt(interrupt) {
    if (_sharedBus) {
        _sharedBusMutex = xSemaphoreCreateMutex();
        configASSERT(_sharedBusMutex);
    }
}

void GearpumpAddon::setup(float *power) {
    _power = power;
    if (_sharedBus) {
        sharedIO = new GearpumpSharedIO(*_sharedBus, _addr, _sharedBusMutex);
        if (!sharedIO->prepare()) {
            ESP_LOGE(LOG_TAG, "Could not initialize shared-bus XL9555");
            return;
        }
        ESP_LOGI(LOG_TAG, "Sharing ADC I2C bus: SDA=%u SCL=%u at 400kHz", _sda, _scl);
    } else {
        if (!extension.init(Wire, _sda, _scl, _addr)) {
            ESP_LOGE(LOG_TAG, "Failed to initialize extension I2C bus");
            return;
        }
        ESP_LOGI(LOG_TAG, "Initialized extension");
        extension.setClock(1000000L);
    }
    i2c = new SoftWire(0, 0);
    i2c->setTxBuffer(swTxBuffer, sizeof(swTxBuffer));
    i2c->setRxBuffer(swRxBuffer, sizeof(swRxBuffer));
    i2c->setReadScl(read_scl);
    i2c->setReadSda(read_sda);
    i2c->setSetSclHigh(scl_high);
    i2c->setSetSdaHigh(sda_high);
    i2c->setSetSclLow(scl_low);
    i2c->setSetSdaLow(sda_low);
    i2c->setTimeout_ms(200);
    i2c->setDelay_us(20);
    i2c->begin();
    delay(500);
    if (_sharedBus) {
        if (!setupSharedDac()) {
            ESP_LOGE(LOG_TAG, "Shared-bus DAC startup failed; pump output task not started");
            return;
        }
    } else {
        mcp = new MCP4725(0x60, i2c);
        if (!mcp->begin())
            return;
        ESP_LOGI(LOG_TAG, "MCP4725 initialized");
        mcp->setMaxVoltage(MCP_VOLTAGE);
        ensureSafePowerOnState();
        mcp->setPercentage(0);
    }
    if (xTaskCreate(loopTask, "GearpumpAddon::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle) != pdPASS)
        ESP_LOGE(LOG_TAG, "Could not start pump output task");
}

// The MCP4725 loads its output from EEPROM at power-on, before the firmware can
// reach it. Program the EEPROM once with a safe default (value 0 + 1k power-down
// pull-down) so the pump stays off at startup, then return the live DAC register
// to normal mode so it stays controllable (EEPROM only governs the next boot).
void GearpumpAddon::ensureSafePowerOnState() {
    if (mcp->readEEPROM() != 0 || mcp->readPowerDownModeEEPROM() != MCP4725_PDMODE_1K) {
        ESP_LOGI(LOG_TAG, "Writing safe power-on default to MCP4725 EEPROM");
        mcp->writeDAC(0, false);                          // clear cached value
        mcp->writePowerDownMode(MCP4725_PDMODE_1K, true); // value 0 + 1k pull-down -> DAC & EEPROM
    }
    mcp->writePowerDownMode(MCP4725_PDMODE_NORMAL, false); // wake live DAC for runtime control
}

// These helpers avoid the MCP4725 library's unbounded EEPROM-ready loops on
// the shared bus. A failed XL9555 operation suppresses further edge transfers
// until a bounded recovery attempt, leaving the ADC free to use the bus.
bool GearpumpAddon::writeSharedDac(const uint8_t *bytes, size_t size) {
    i2c->beginTransmission(0x60);
    i2c->write(bytes, size);
    return i2c->endTransmission() == 0 && !sharedIO->failed();
}

bool GearpumpAddon::readSharedDac(uint8_t *state) {
    if (i2c->requestFrom(uint8_t(0x60), uint8_t(5)) != 5 || sharedIO->failed())
        return false;
    for (unsigned i = 0; i < 5; ++i)
        state[i] = i2c->read();
    return true;
}

bool GearpumpAddon::setupSharedDac() {
    uint8_t state[5];
    auto waitReady = [&]() {
        const uint32_t started = millis();
        do {
            if (!readSharedDac(state))
                return false;
            if (state[0] & 0x80)
                return true;
            delay(5);
        } while (millis() - started < 1000);
        return false;
    };
    if (!waitReady())
        return false;
    const uint8_t off[] = {0, 0};
    if (!writeSharedDac(off, sizeof(off)))
        return false;
    const uint16_t stored = ((state[3] & 0x0F) << 8) | state[4];
    if (stored != 0 || ((state[3] >> 5) & 3) != MCP4725_PDMODE_1K) {
        // Zero DAC output + 1k pull-down at next power-on, matching the Pro path.
        const uint8_t safe[] = {uint8_t(0x60 | (MCP4725_PDMODE_1K << 1)), 0, 0};
        if (!writeSharedDac(safe, sizeof(safe)) || !waitReady())
            return false;
    }
    if (!writeSharedDac(off, sizeof(off)))
        return false;
    _lastDacValue = 0;
    ESP_LOGI(LOG_TAG, "Shared-bus MCP4725 initialized with output off");
    return true;
}

void GearpumpAddon::loop() {
    if (_sharedBus) {
        if (_power == nullptr)
            return;
        if (_sharedFault) {
            if (millis() - _lastRetry < 1000)
                return;
            _lastRetry = millis();
            if (!sharedIO->prepare())
                return;
            i2c->stop(false);
        }
        const float power = *_power;
        const float fraction = power / 100.0f * _maxPower;
        const uint16_t value =
            std::isfinite(fraction) ? uint16_t(std::round(std::max(0.0f, std::min(1.0f, fraction)) * MCP4725_MAXVALUE)) : 0;
        if (!_sharedFault && value == _lastDacValue)
            return;
        const uint8_t bytes[] = {uint8_t(value >> 8), uint8_t(value)};
        if (!writeSharedDac(bytes, sizeof(bytes))) {
            if (!_sharedFault)
                ESP_LOGE(LOG_TAG, "Shared-bus DAC write failed; retrying at most once per second");
            _sharedFault = true;
            _lastRetry = millis();
            return;
        }
        if (_sharedFault)
            ESP_LOGI(LOG_TAG, "Shared-bus DAC communication recovered");
        _sharedFault = false;
        _lastDacValue = value;
        return;
    }
    if (_power != nullptr) {
        _currentPower = *_power;
        float voltage = MCP_VOLTAGE * (_currentPower / 100.0f * _maxPower);
        mcp->setVoltage(voltage);
    }
}

void GearpumpAddon::stop() { _currentPower = 0.0f; }

void GearpumpAddon::setMaxPower(float maxPower) { _maxPower = maxPower; }

void GearpumpAddon::loopTask(void *arg) {
    auto *pump = static_cast<GearpumpAddon *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        pump->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(30));
    }
}
