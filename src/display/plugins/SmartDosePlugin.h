#pragma once
#include <display/core/Plugin.h>
#include <ArduinoJson.h>
#include <mutex>
#include "SmartDoseCoordinator.h"

class SmartDosePlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pm) override;
    void loop() override;
    bool setDose();
    bool adjustDose(int direction);
    bool calibrate(const String &accessory = "cup");
    void cancelCycle();
    void onTare(bool hardware);
    void status(JsonObject out);
    struct DoseUIState {
        int32_t state = 0; // 0 hidden, 1 cup, 2 manual, 3 portafilter
        bool available = false;
        bool blinking = false;
        float weight = 0;
    };
    DoseUIState getUIState();
  private:
    void measurement(float weight, bool hardware);
    void sync();
    void apply(const smartdose::Action &action);
    bool canAdjustDose() const;
    bool skipDisabled();
    bool healthy(bool hardware) const;
    bool selectedHardware() const;
    bool portafilterSelected() const;
    bool available() const;
    float doseWeight() const;
    Controller *controller = nullptr;
    std::recursive_mutex mutex;
    smartdose::Coordinator coordinator;
    // Presentation only: the coordinator intentionally ignores non-owner samples.
    struct LiveReading {
        float weight = 0;
        uint32_t last = 0;
        bool present = false;
    };
    LiveReading liveReadings[2];
    bool tarePending = false;
    String profileId;
};
extern SmartDosePlugin SmartDose;
