#include <Arduino.h>
#include "MockBLEClientController.h"

MockBLEClientController::MockBLEClientController() = default;
MockBLEClientController::~MockBLEClientController() = default;

void MockBLEClientController::initClient() {
    delay(10);
}

bool MockBLEClientController::connectToServer() {
    delay(10);
    return true;
}

void MockBLEClientController::sendOutputControl(bool valve, float pumpSetpoint, float boilerSetpoint) {
    delay(10);
}

void MockBLEClientController::sendAltControl(bool pinState) {
    delay(10);
}

void MockBLEClientController::sendPing() {
    delay(10);
}

void MockBLEClientController::sendAutotune(int testTime, int samples) {
    delay(10);
}

void MockBLEClientController::sendPidSettings(const String &pid) {
    delay(10);
}

void MockBLEClientController::setPressureScale(float scale) {
    delay(10);
}

bool MockBLEClientController::isReadyForConnection() const {
    delay(10);
    return true;
}

bool MockBLEClientController::isConnected() {
    delay(10);
    return true;
}

void MockBLEClientController::scan() {
    delay(10);
}

void MockBLEClientController::registerRemoteErrorCallback(const remote_err_callback_t &callback) {
    remoteErrorCallback = callback;
    delay(10);
}

void MockBLEClientController::registerBrewBtnCallback(const brew_callback_t &callback) {
    brewBtnCallback = callback;
    delay(10);
}

void MockBLEClientController::registerSteamBtnCallback(const steam_callback_t &callback) {
    steamBtnCallback = callback;
    delay(10);
}

void MockBLEClientController::registerSensorCallback(const sensor_read_callback_t &callback) {
    sensorCallback = callback;
    delay(10);
}

void MockBLEClientController::registerAutotuneResultCallback(const pid_control_callback_t &callback) {
    autotuneResultCallback = callback;
    delay(10);
}

std::string MockBLEClientController::readInfo() const {
    delay(10);
    static const std::string info = "{\"hw\":\"GaggiMate Standard 1.x\",\"v\":\"v1.4.4\",\"cp\":{\"ps\":true,\"dm\":true}}";
    return info;
}

void* MockBLEClientController::getClient() const {
    delay(10);
    
    return nullptr;
}

void MockBLEClientController::triggerRemoteError(int errorCode) {
    if (remoteErrorCallback) remoteErrorCallback(errorCode);
}

void MockBLEClientController::triggerBrewBtn(bool brewButtonStatus) {
    if (brewBtnCallback) brewBtnCallback(brewButtonStatus);
}

void MockBLEClientController::triggerSteamBtn(bool steamButtonStatus) {
    if (steamBtnCallback) steamBtnCallback(steamButtonStatus);
}

void MockBLEClientController::triggerSensor(float temperature, float pressure) {
    if (sensorCallback) sensorCallback(temperature, pressure);
}

void MockBLEClientController::triggerAutotuneResult(float Kp, float Ki, float Kd) {
    if (autotuneResultCallback) autotuneResultCallback(Kp, Ki, Kd);
}
