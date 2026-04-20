#ifndef MATTERPLUGIN_H
#define MATTERPLUGIN_H

#ifdef GAGGIMATE_MATTER

#include "../core/Plugin.h"
#include <cstdint>

struct Event;

class MatterPlugin : public Plugin {
  public:
    struct OnboardingInfo {
        bool started = false;      // Matter stack running
        bool commissioned = false; // at least one fabric bound
        uint32_t fabricCount = 0;
        uint16_t vendorId = 0;
        uint16_t productId = 0;
        uint16_t discriminator = 0;
        uint32_t passcode = 0;
        char qrPayload[64] = {0}; // "MT:..." base-38 payload
        char manualCode[16] = {0};
    };

    static MatterPlugin *instance();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    // All Matter work is event-driven; no per-tick polling needed.
    void loop() override {};

    // val is actually `esp_matter_attr_val_t *`; kept opaque to avoid pulling Matter headers into this include.
    void onAttributeWrite(uint16_t endpoint_id, uint32_t cluster_id, uint32_t attribute_id, void *val);

    // Returns true if Matter started and onboarding data was populated.
    bool getOnboardingInfo(OnboardingInfo &out) const;

  private:
    void start(Event const &event);
    void onModeChange(int mode);
    void onTargetTempChange(float temperature);
    void onCurrentTempChange(float temperature);

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    bool started = false;
    uint16_t endpointId = 0;
    // Breaks the Matter write → Controller::setX → event → onXChange → Matter
    // update → pre-attribute-change callback → Matter write ... recursion
    // that stack-overflows in ~25 frames.
    bool applyingFromMatter = false;
};

#endif // GAGGIMATE_MATTER

#endif // MATTERPLUGIN_H
