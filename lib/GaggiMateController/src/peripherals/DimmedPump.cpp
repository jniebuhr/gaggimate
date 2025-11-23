#include "DimmedPump.h"

#include <ExtensionIOXL9555.hpp>
#include <GaggiMateController.h>

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

DimmedPump::DimmedPump(uint8_t ssr_pin, uint8_t sense_pin, PressureSensor *pressure_sensor, uint8_t scl_pin, uint8_t sda_pin)
    : _ssr_pin(ssr_pin), _sense_pin(sense_pin), _psm(_sense_pin, _ssr_pin, 100, FALLING, 2, 4), _pressureSensor(pressure_sensor),
      _pressureController(0.03f, &_ctrlPressure, &_ctrlFlow, &_currentPressure, &_controllerPower, &_valveStatus) {
    _psm.set(0);
    if (!extension.init(Wire, sda_pin, scl_pin, XL9555_SLAVE_ADDRESS0)) {
        ESP_LOGE(LOG_TAG, "Failed to initialize extension I2C bus");
    } else {
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
    mcp = new MCP4725(0x60, i2c);
    if (!mcp->begin()) {
        ESP_LOGE(LOG_TAG, "Failed to initialize MCP4725");
    }
    mcp->setMaxVoltage(MCP_VOLTAGE);
}

void DimmedPump::setup() {
    _cps = _psm.cps();
    if (_cps > 70) {
        _cps = _cps / 2;
    }
    xTaskCreate(loopTask, "DimmedPump::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DimmedPump::loop() {
    _currentPressure = _pressureSensor->getRawPressure();
    updatePower();
    // _currentFlow = 0.1f * _pressureController.getPumpFlowRate() + 0.9f * _currentFlow;
    _currentFlow = _pressureController.getPumpFlowRate();
}

void DimmedPump::setPower(float setpoint) {
    ESP_LOGV(LOG_TAG, "Setting power to %2f", setpoint);
    _ctrlPressure = setpoint > 0 ? 20.0f : 0.0f;
    _mode = ControlMode::POWER;
    _power = std::clamp(setpoint, 0.0f, 100.0f);
    _controllerPower = _power; // Feed manual control back into pressure controller
    if (_power == 0.0f) {
        _currentFlow = 0.0f;
    }
    _psm.set(static_cast<int>(_power));
    mcp->setVoltage(MCP_VOLTAGE * _power / 100.0f);
}

float DimmedPump::getCoffeeVolume() { return _pressureController.getCoffeeOutputEstimate(); }

float DimmedPump::getPumpFlow() { return _currentFlow; }

float DimmedPump::getPuckFlow() { return _pressureController.getCoffeeFlowRate(); }

float DimmedPump::getPuckResistance() { return _pressureController.getPuckResistance(); }

void DimmedPump::tare() {
    _pressureController.tare();
    _pressureController.reset();
}

void DimmedPump::loopTask(void *arg) {
    auto *pump = static_cast<DimmedPump *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        pump->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(30));
    }
}

void DimmedPump::updatePower() {
    _pressureController.update(static_cast<PressureController::ControlMode>(_mode));
    if (_mode != ControlMode::POWER) {
        _power = _controllerPower;
    }
    _psm.set(static_cast<int>(_power));
    mcp->setVoltage(MCP_VOLTAGE * _power / 100.0f);
}

void DimmedPump::setFlowTarget(float targetFlow, float pressureLimit) {
    _mode = ControlMode::FLOW;
    _ctrlFlow = targetFlow;
    _ctrlPressure = pressureLimit;
    _pressureController.setPressureLimit(pressureLimit);
}

void DimmedPump::setPressureTarget(float targetPressure, float flowLimit) {
    _mode = ControlMode::PRESSURE;
    _ctrlFlow = flowLimit;
    _ctrlPressure = targetPressure;
    _pressureController.setFlowLimit(flowLimit);
}

void DimmedPump::setValveState(bool open) { _valveStatus = open; }

void DimmedPump::setPumpFlowCoeff(float oneBarFlow, float nineBarFlow) {
    _pressureController.setPumpFlowCoeff(oneBarFlow, nineBarFlow);
}

void DimmedPump::setPumpFlowPolyCoeffs(float a, float b, float c, float d) {
    _pressureController.setPumpFlowPolyCoeffs(a, b, c, d);
}
