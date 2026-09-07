#ifndef DOUBLETAPTAREPLUGIN_H
#define DOUBLETAPTAREPLUGIN_H

#include <cstddef>
#include <cstdint>
#include "../core/Plugin.h"

// Detects tap gestures on the connected BLE scale from its weight stream and
// maps them to actions, similar to the Decent "Half Decent Scale" tap logic:
//
//   double tap  -> tare the scale
//   triple tap  -> cycle the scale timer (start -> stop -> reset)
//
// Both gestures are optional via the "doubleTapTareEnabled" /
// "tripleTapTimerEnabled" settings (settings keys dtt_en / dtt_tt).
//
// Detection (ported from the working dot-scale-mate implementation):
// 1. Steady state: 100 ms samples; 5 samples (500 ms) within 0.5 g of each
//    other establish a baseline.
// 2. Peak: a rise followed by a fall, height above the baseline > 20 g.
// 3. Sequence: peaks closer than 400 ms chain together. Two peaks with no
//    third within the 400 ms decision window = double tap; three consecutive
//    peaks = triple tap.
// 4. Recovery: weight returns to baseline +/- 0.5 g.
// 5. Action fires 500 ms after recovery (so a placed object can settle).
class DoubleTapTarePlugin : public Plugin {
  public:
    DoubleTapTarePlugin() = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void onWeightSample(float weight);
    void fireAction(bool triple);

    // Tuning constants (same values as the reference implementation).
    static constexpr float TAP_PEAK_G = 20.0f;       // peak height above baseline
    static constexpr float TAP_PEAK_SLOPE = 2.0f;    // min rise/fall slope
    static constexpr unsigned long TAP_SAMPLE_MS = 100;
    static constexpr size_t TAP_STEADY_N = 5;        // samples for a steady baseline
    static constexpr float TAP_STEADY_RANGE = 0.5f;  // max spread for steady state
    static constexpr unsigned long TAP_DOUBLE_MS = 400; // max gap to chain peaks
    static constexpr float TAP_RECOVER_G = 0.5f;     // return-to-baseline tolerance
    static constexpr unsigned long TAP_TARE_DELAY_MS = 500; // fire delay after recovery

    Controller *controller = nullptr;

    // Tap state machine.
    float tapHist[TAP_STEADY_N] = {0};
    size_t tapHistIdx = 0;
    size_t tapHistCount = 0;
    unsigned long tapSampleMs = 0;
    bool tapSteady = false;
    float tapBaseline = 0.0f;
    float tapPrevW = 0.0f;
    bool tapRising = false;
    unsigned long tapLastPeakMs = 0;
    uint8_t tapSeqCount = 0;
    unsigned long tapDecisionAtMs = 0;
    bool tapDecisionPending = false;
    uint8_t tapTripleSeq = 0; // triple-tap timer cycle: 0=start, 1=stop, 2=reset
};

#endif // DOUBLETAPTAREPLUGIN_H
