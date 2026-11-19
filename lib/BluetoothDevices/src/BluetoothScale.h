#pragma once
#include "BluetoothDevice.h"

// UNKNOWN is the safe default for drivers that do not report the unit; a scale in ounces would corrupt gram targets.
enum class ScaleWeightUnit : uint8_t { UNKNOWN = 0, GRAM = 1, OUNCE = 2 };

// A scale: weight and tare are mandatory, everything else is optional and announced by the matching hasX().
class BluetoothScale : public BluetoothDevice {
  public:
    static constexpr BluetoothDeviceType TYPE = BluetoothDeviceType::SCALE;

    BluetoothScale *asScale() override { return this; }

    float getWeight() const { return weight; }

    // Optional native fields; drivers call the protected setters and override the matching hasX().
    float getFlowRate() const { return flowRate; }            // g/s, native from scale when available
    uint32_t getScaleTimerMs() const { return scaleTimerMs; } // scale's internal stopwatch
    ScaleWeightUnit getWeightUnit() const { return weightUnit; }
    uint8_t getAutoModeStopCondition() const { return autoModeStopCondition; } // driver-defined

    virtual bool hasFlowRate() const { return false; }
    virtual bool hasScaleTimer() const { return false; }
    virtual bool hasWeightUnit() const { return false; }
    virtual bool hasAutoModeStopCondition() const { return false; }
    virtual bool hasTimerControl() const { return false; }

    void setWeightUpdatedCallback(void (*callback)(float), bool onlyChanges = false);

    virtual bool tare() = 0;

    // Stopwatch control; no-ops unless hasTimerControl() is true.
    virtual void startTimer() {}
    virtual void stopTimer() {}
    virtual void resetTimer() {}

  protected:
    explicit BluetoothScale(const DiscoveredDevice &device) : BluetoothDevice(device, TYPE) {}

    void setWeight(float newWeight);

    void setFlowRate(float newFlow) { flowRate = newFlow; }
    void setScaleTimerMs(uint32_t t) { scaleTimerMs = t; }
    void setWeightUnit(ScaleWeightUnit u) { weightUnit = u; }
    void setAutoModeStopCondition(uint8_t c) { autoModeStopCondition = c; }

  private:
    using WeightCallback = void (*)(float);

    float weight = 0.f;
    float flowRate = 0.0f;
    uint32_t scaleTimerMs = 0;
    ScaleWeightUnit weightUnit = ScaleWeightUnit::UNKNOWN;
    uint8_t autoModeStopCondition = 0;

    WeightCallback weightCallback = nullptr;
    bool weightCallbackOnlyChanges = false;
};
