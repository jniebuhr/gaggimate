#include "GearpumpAddon.h"
#include <ExtensionIOXL9555.hpp>

#define MCP_VOLTAGE 5.0f

static ExtensionIOXL9555 extension;

char swTxBuffer[128];
char swRxBuffer[128];

uint8_t read_scl(const SoftWire *i2c) {
    uint8_t value = extension.digitalRead(ExtensionIOXL9555::IO0);
    ESP_LOGV("MCP4725", "Read SCL: %d", value);
    return value;
}

uint8_t read_sda(const SoftWire *i2c) {
    uint8_t value = extension.digitalRead(ExtensionIOXL9555::IO1);
    ESP_LOGV("MCP4725", "Read SDA: %d", value);
    return value;
}

void scl_high(const SoftWire *i2c) {
    extension.pinMode(ExtensionIOXL9555::IO0, INPUT);
    ESP_LOGV("MCP4725", "Release SCL");
}

void sda_high(const SoftWire *i2c) {
    extension.pinMode(ExtensionIOXL9555::IO1, INPUT);
    ESP_LOGV("MCP4725", "Release SDA");
}

void scl_low(const SoftWire *i2c) {
    extension.pinMode(ExtensionIOXL9555::IO0, OUTPUT);
    extension.digitalWrite(ExtensionIOXL9555::IO0, LOW);
    ESP_LOGV("MCP4725", "Write SCL: %d", 0);
}

void sda_low(const SoftWire *i2c) {
    extension.pinMode(ExtensionIOXL9555::IO1, OUTPUT);
    extension.digitalWrite(ExtensionIOXL9555::IO1, LOW);
    ESP_LOGV("MCP4725", "Write SDA: %d", 0);
}

GearpumpAddon::GearpumpAddon(uint8_t addr, uint8_t sda, uint8_t scl, uint8_t interrupt)
    : _addr(addr), _sda(sda), _scl(scl), _interrupt(interrupt) {}

void GearpumpAddon::setup(float *power) {
    _power = power;
    if (!extension.init(Wire, _sda, _scl, _addr)) {
        ESP_LOGE(LOG_TAG, "Failed to initialize extension I2C bus");
        return;
    }

    ESP_LOGI(LOG_TAG, "Initialized extension");
    extension.setClock(1000000L);
    /*
    extension.setPinEvent(GPIO_NUM_2, LOW, [](void* userdata) {
        ESP_LOGI("GearpumpAddon", "Flow Counter");
    }, 0);
    */
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
    mcp = new MCP4725(0x60, i2c);
    if (!mcp->begin()) {
        return;
    }
    ESP_LOGI(LOG_TAG, "MCP4725 initialized");
    mcp->setMaxVoltage(MCP_VOLTAGE);
    mcp->setPercentage(0);

    xTaskCreate(loopTask, "GearpumpAddon::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void GearpumpAddon::loop() {
    if (_power != nullptr) {
        _currentPower = *_power * 0.05f + _currentPower * 0.95f;
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
