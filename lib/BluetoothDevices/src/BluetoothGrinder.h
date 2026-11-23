#pragma once
#include "BluetoothDevice.h"
#include "GrinderSettings.h"

// A grinder: accepts recipe settings and reports what it currently runs with.
class BluetoothGrinder : public BluetoothDevice {
  public:
    static constexpr BluetoothDeviceType TYPE = BluetoothDeviceType::GRINDER;

    BluetoothGrinder *asGrinder() override { return this; }

    // Queues the set fields for transfer; drivers send them from update() once the link is ready.
    virtual bool applySettings(const GrinderSettings &settings) = 0;

    // Which settings the grinder can take over Bluetooth.
    virtual bool supportsGrindSize() const { return false; }
    virtual bool supportsRpm() const { return false; }
    virtual bool supportsFeedRpm() const { return false; }

    // Last values reported by the grinder; fields it does not report stay unset.
    const GrinderSettings &getReportedSettings() const { return reportedSettings; }
    GrinderState getState() const { return state; }

  protected:
    explicit BluetoothGrinder(const DiscoveredDevice &device) : BluetoothDevice(device, TYPE) {}

    void setReportedSettings(const GrinderSettings &settings) { reportedSettings = settings; }
    void setState(GrinderState newState) { state = newState; }

  private:
    GrinderSettings reportedSettings;
    GrinderState state = GrinderState::UNKNOWN;
};
