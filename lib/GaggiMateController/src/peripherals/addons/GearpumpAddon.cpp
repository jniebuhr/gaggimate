#include "GearpumpAddon.h"
#include "GearpumpSharedIO.h"
#include <algorithm>
#include <cmath>
#include <peripherals/ADSAdc.h>

static constexpr uint8_t DAC_ADDRESS = 0x60;
static constexpr uint32_t VERIFY_INTERVAL_MS = 1000;
static constexpr uint8_t VERIFY_ATTEMPTS = 3;

static GearpumpSharedIO *io = nullptr;

static char swTxBuffer[128];
static char swRxBuffer[128];

// The MCP4725 never stretches the clock, so the driven SCL state replaces an expander read per edge.
static uint8_t read_scl(const SoftWire *i2c) { return io->released(0) ? HIGH : LOW; }

static uint8_t read_sda(const SoftWire *i2c) { return io->readPin(1); }

static void scl_high(const SoftWire *i2c) { io->setPin(0, true); }

static void sda_high(const SoftWire *i2c) { io->setPin(1, true); }

static void scl_low(const SoftWire *i2c) { io->setPin(0, false); }

static void sda_low(const SoftWire *i2c) { io->setPin(1, false); }

GearpumpAddon::GearpumpAddon(uint8_t addr, uint8_t sda, uint8_t scl, uint8_t interrupt, TwoWire &bus, bool sharedWithAdc)
    : _bus(bus), _sharedWithAdc(sharedWithAdc), _addr(addr), _sda(sda), _scl(scl), _interrupt(interrupt) {
    if (_sharedWithAdc) {
        _busMutex = xSemaphoreCreateMutex();
        configASSERT(_busMutex);
    }
}

void GearpumpAddon::setup(float *power) {
    _power = power;
    io = new GearpumpSharedIO(_bus, _addr, _busMutex);
    const bool expanderReady = io->prepare();
    if (!expanderReady)
        ESP_LOGE(LOG_TAG, "Could not initialize the XL9555");
    else
        ESP_LOGI(LOG_TAG, "%s I2C bus: SDA=%u SCL=%u at %lu Hz", _sharedWithAdc ? "Sharing ADC" : "Own", _sda, _scl,
                 static_cast<unsigned long>(ADC_I2C_CLOCK_HZ));
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
    i2c->setDelay_us(0); // each edge is an expander write, far slower than the DAC needs
    i2c->begin();
    delay(500);
    // Until the DAC answers it keeps its EEPROM power-on state (output 0, 1k pull-down); the task retries.
    _ready = expanderReady && setupDac();
    if (!_ready) {
        ESP_LOGE(LOG_TAG, "DAC startup failed; retrying at most once per second");
        _lastRetry = millis();
    }
    if (xTaskCreate(loopTask, "GearpumpAddon::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle) != pdPASS)
        ESP_LOGE(LOG_TAG, "Could not start pump output task");
}

// SoftWire transfers for setup and read-back, with bounded waits instead of the MCP4725 library's
// unbounded EEPROM-ready loops. A failed XL9555 operation suppresses further edges until a retry.
bool GearpumpAddon::writeDac(const uint8_t *bytes, size_t size) {
    i2c->beginTransmission(DAC_ADDRESS);
    i2c->write(bytes, size);
    return i2c->endTransmission() == 0 && !io->failed();
}

bool GearpumpAddon::readDac(uint8_t *state) {
    if (i2c->requestFrom(DAC_ADDRESS, uint8_t(5)) != 5 || io->failed())
        return false;
    for (unsigned i = 0; i < 5; ++i)
        state[i] = i2c->read();
    return true;
}

bool GearpumpAddon::verifyDac(uint16_t expected) {
    _lastVerify = millis();
    uint8_t state[5];
    const bool ok = readDac(state) && ((uint16_t(state[1]) << 4 | state[2] >> 4) == expected) &&
                    ((state[0] >> 1) & 3) == MCP4725_PDMODE_NORMAL;
    if (ok) {
        _verifyFailures = 0;
        return true;
    }
    _lastDacValue = UINT16_MAX; // rewrite on the next loop
    if (++_verifyFailures >= VERIFY_ATTEMPTS) {
        if (!_fault)
            ESP_LOGE(LOG_TAG, "DAC read-back does not match; retrying at most once per second");
        _fault = true;
        _lastRetry = millis();
    }
    return false;
}

// The MCP4725 loads its output from EEPROM at power-on, before the firmware can reach it. Keep the EEPROM
// at a safe default (value 0 + 1k power-down pull-down) and leave the live DAC in normal mode at 0.
bool GearpumpAddon::setupDac() {
    uint8_t state[5];
    auto waitReady = [&]() {
        const uint32_t started = millis();
        do {
            if (!readDac(state))
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
    if (!writeDac(off, sizeof(off)))
        return false;
    const uint16_t stored = ((state[3] & 0x0F) << 8) | state[4];
    if (stored != 0 || ((state[3] >> 5) & 3) != MCP4725_PDMODE_1K) {
        ESP_LOGI(LOG_TAG, "Writing safe power-on default to MCP4725 EEPROM");
        const uint8_t safe[] = {uint8_t(0x60 | (MCP4725_PDMODE_1K << 1)), 0, 0};
        if (!writeDac(safe, sizeof(safe)) || !waitReady())
            return false;
    }
    if (!writeDac(off, sizeof(off)))
        return false;
    _lastDacValue = 0;
    ESP_LOGI(LOG_TAG, "MCP4725 initialized with output off");
    return true;
}

void GearpumpAddon::loop() {
    if (_power == nullptr)
        return;
    if (_fault || !_ready) {
        if (millis() - _lastRetry < 1000)
            return;
        _lastRetry = millis();
        if (!io->prepare())
            return;
        i2c->stop(false);
        if (!_ready) {
            if (!setupDac())
                return;
            _ready = true;
            ESP_LOGI(LOG_TAG, "DAC started after retry");
        }
    }
    const float fraction = *_power / 100.0f * _maxPower;
    const uint16_t value =
        std::isfinite(fraction) ? uint16_t(std::round(std::max(0.0f, std::min(1.0f, fraction)) * MCP4725_MAXVALUE)) : 0;
    if (!_fault && value == _lastDacValue) {
        if (millis() - _lastVerify >= VERIFY_INTERVAL_MS)
            verifyDac(value);
        return;
    }
    // Fast write, normal mode. A burst cannot see the DAC's ACKs, so the result is confirmed by reading it back.
    const uint8_t bytes[] = {uint8_t(value >> 8), uint8_t(value)};
    if (!io->burstWrite(DAC_ADDRESS, bytes, sizeof(bytes))) {
        if (!_fault)
            ESP_LOGE(LOG_TAG, "DAC write failed; retrying at most once per second");
        _fault = true;
        _lastRetry = millis();
        return;
    }
    if (_fault)
        ESP_LOGI(LOG_TAG, "DAC communication recovered");
    _fault = false;
    _lastDacValue = value;
    if (value == 0)
        verifyDac(0); // a pump stop is always confirmed
}

void GearpumpAddon::setMaxPower(float maxPower) { _maxPower = maxPower; }

void GearpumpAddon::loopTask(void *arg) {
    auto *pump = static_cast<GearpumpAddon *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        pump->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(30));
    }
}
