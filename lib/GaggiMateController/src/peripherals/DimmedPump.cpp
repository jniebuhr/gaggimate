#include "DimmedPump.h"

#include <ExtensionIOXL9555.hpp>
#include <GaggiMateController.h>

static ExtensionIOXL9555 extension;

static char swTxBuffer[128];
static char swRxBuffer[128];

uint8_t read_scl(const SoftWire *) { return extension.digitalRead(ExtensionIOXL9555::IO0); }
uint8_t read_sda(const SoftWire *) { return extension.digitalRead(ExtensionIOXL9555::IO1); }
void scl_high(const SoftWire *) { extension.pinMode(ExtensionIOXL9555::IO0, INPUT); }
void sda_high(const SoftWire *) { extension.pinMode(ExtensionIOXL9555::IO1, INPUT); }
void scl_low(const SoftWire *) {
    extension.pinMode(ExtensionIOXL9555::IO0, OUTPUT);
    extension.digitalWrite(ExtensionIOXL9555::IO0, LOW);
}
void sda_low(const SoftWire *) {
    extension.pinMode(ExtensionIOXL9555::IO1, OUTPUT);
    extension.digitalWrite(ExtensionIOXL9555::IO1, LOW);
}

DimmedPump::DimmedPump(uint8_t ssr_pin, uint8_t sense_pin, uint8_t rpm_pin, PressureSensor *pressureSensor, uint8_t scl_pin,
                       uint8_t sda_pin)
    : _ssr_pin(ssr_pin),
      _sense_pin(sense_pin),
      _rpm_pin(rpm_pin),
      _psm(_sense_pin, _ssr_pin, 100, FALLING, 2, 4),
      _pressureSensor(pressureSensor),
      _rpmSensor(rpm_pin, 2),
      _pressureController(LOOP_DT, &_ctrlPressure, &_ctrlFlow, &_currentPressure, &_controllerPower, &_valveStatus) {
    // Start with pump output disabled.
    _psm.set(0);

    // Initialize the extension I/O expander used by the DAC interface.
    if (!extension.init(Wire, sda_pin, scl_pin, XL9555_UNKOWN_ADDRESS)) {
        ESP_LOGE(LOG_TAG, "Failed to initialize extension I2C bus");
    } else {
        extension.setClock(1000000L);
    }

    // Use a software I2C bus through the extension IO for the DAC.
    i2c = new SoftWire(0, 0);
    i2c->setTxBuffer(swTxBuffer, sizeof(swTxBuffer));
    i2c->setRxBuffer(swRxBuffer, sizeof(swRxBuffer));
    i2c->setReadScl(read_scl);
    i2c->setReadSda(read_sda);
    i2c->setSetSclHigh(scl_high);
    i2c->setSetSdaHigh(sda_high);
    i2c->setSetSclLow(scl_low);
    i2c->setSetSdaLow(sda_low);
    i2c->begin();

    delay(200);

    // MCP4725 drives the analog control voltage for the pump.
    mcp = new MCP4725(0x60, i2c);
    mcp->setMaxVoltage(MCP_VOLTAGE);
    mcp->begin();
}

void DimmedPump::setup() {
    // Configure RPM sampling and background loop task.
    _rpmSensor.setup();
    xTaskCreate(loopTask, "DimmedPump::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DimmedPump::loop() {
    // Read pressure, map RPM/pressure to flow, and feed the controller.
    _currentPressure = _pressureSensor->getRawPressure();

    // Update RPM sampling and derive flow from the vendor map.
    _rpmSensor.update();
    float rpm = _rpmSensor.getRPM();

    // Map RPM/pressure to flow (datasheet table, ml/min -> ml/s).
    float mappedFlowMlPerS = 0.0f;
    if (rpm >= FlowMap::rpmAxis[0]) {
        float mappedFlowMlPerMin = FlowMap::getFlow(rpm, _currentPressure);
        mappedFlowMlPerS = mappedFlowMlPerMin / 60.0f;
    }

    _availableFlow = mappedFlowMlPerS;
    _estimatedFlow = FLOW_FILTER_ALPHA * mappedFlowMlPerS + (1.0f - FLOW_FILTER_ALPHA) * _estimatedFlow;

    // Provide available flow to the pressure controller when pressure is valid.
    if (_currentPressure >= PRESSURE_MIN_FOR_EST) {
        _pressureController.injectAvailableFlow(_availableFlow);
    } else {
        _pressureController.clearAvailableFlow();
    }

    updatePower();

    _currentFlow = _estimatedFlow;
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
    // Update controller output and apply power to SSR + DAC.
    _pressureController.update(static_cast<PressureController::ControlMode>(_mode));

    if (_mode != ControlMode::POWER) {
        _power = _controllerPower;
    }

    _power = std::clamp(_power, 0.0f, 100.0f);

    _psm.set(static_cast<int>(_power));
    mcp->setVoltage(MCP_VOLTAGE * _power / 100.0f);
}

void DimmedPump::setPower(float setpoint) {
    _mode = ControlMode::POWER;
    _power = std::clamp(setpoint, 0.0f, 100.0f);
    _ctrlPressure = (_power > 0.0f) ? 20.0f : 0.0f;
}

void DimmedPump::setFlowTarget(float targetFlow, float pressureLimit) {
    _mode = ControlMode::FLOW;
    _ctrlFlow = targetFlow;
    _ctrlPressure = pressureLimit;
}

void DimmedPump::setPressureTarget(float targetPressure, float flowLimit) {
    _mode = ControlMode::PRESSURE;
    _ctrlPressure = targetPressure;
    _ctrlFlow = flowLimit;
}

float DimmedPump::getCoffeeVolume() { return _pressureController.getCoffeeOutputEstimate(); }

float DimmedPump::getPumpFlow() { return _currentFlow; }

float DimmedPump::getPuckFlow() { return _pressureController.getCoffeeFlowRate(); }

float DimmedPump::getPuckResistance() { return _pressureController.getPuckResistance(); }

float *DimmedPump::getPumpFlowPtr() { return &_currentFlow; }

int *DimmedPump::getValveStatusPtr() { return &_valveStatus; }

void DimmedPump::tare() {
    _pressureController.tare();
    _pressureController.reset();
}

void DimmedPump::setValveState(bool open) { _valveStatus = open ? 1 : 0; }

void DimmedPump::setPumpFlowCoeff(float oneBarFlow, float nineBarFlow) {
    _pressureController.setPumpFlowCoeff(oneBarFlow, nineBarFlow);
}

void DimmedPump::setPumpFlowPolyCoeffs(float a, float b, float c, float d) {
    _pressureController.setPumpFlowPolyCoeffs(a, b, c, d);
}
