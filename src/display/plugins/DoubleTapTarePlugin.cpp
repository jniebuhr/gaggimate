#include "DoubleTapTarePlugin.h"
#include "BLEScalePlugin.h"
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <esp_log.h>
#include <cmath>

static const char *LOG_TAG = "DoubleTapTarePlugin";

// Weight tap detection, ported from the working blescale-tester
// implementation (tuned against real tap data):
//   - steady state: 5 samples (500 ms) spread < 0.5 g -> baseline
//   - peak: rise > 2 g/sample then fall, height above baseline > peakG
//   - sequence: peaks closer than the window setting chain up. Two peaks =
//     double tap -> tare; three consecutive peaks = triple tap -> timer
//     (start -> stop -> reset), cancelling the pending double decision.
//   - fires when the window expires (no extra delay; single peaks and placed
//     objects never fire, verified on real data)
//
// Real-data measurements (60 s capture, Acaia): double-tap peak gaps were
// 155-307 ms, single taps >= 1.2 s apart, peak heights 20-73 g, placed
// objects produced no peaks at all.
static constexpr float TAP_PEAK_SLOPE = 2.0f;
static constexpr unsigned long TAP_SAMPLE_MS = 100;
static constexpr size_t TAP_STEADY_N = 5;
static constexpr float TAP_STEADY_RANGE = 0.5f;

void DoubleTapTarePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    // Feed on the BLE scale's weight stream. This event fires from the NimBLE
    // task at the scale's native cadence (~2-10 Hz); the state machine below
    // only does float arithmetic, so running it here is safe.
    pluginManager->on("controller:volumetric-measurement:bluetooth:change",
                      [this](const Event &event) {
                          float w = event.getFloat("value");
                          if (std::isfinite(w)) {
                              onWeightSample(w);
                          }
                      });

    ESP_LOGI(LOG_TAG, "Double Tap Tare plugin initialized");
}

void DoubleTapTarePlugin::loop() {
    // Actions fire from the measurement callback; loop exists for the Plugin
    // interface only.
}

void DoubleTapTarePlugin::onWeightSample(float w) {
    const unsigned long now = millis();
    const float peakG = static_cast<float>(controller->getSettings().getDoubleTapPeakG());
    const unsigned long windowMs =
        static_cast<unsigned long>(controller->getSettings().getDoubleTapWindowMs());

    // --- Steady-state baseline --------------------------------------------
    if (now - tapSampleMs >= TAP_SAMPLE_MS) {
        tapSampleMs = now;
        tapHist[tapHistIdx] = w;
        tapHistIdx = (tapHistIdx + 1) % TAP_STEADY_N;
        if (tapHistCount < TAP_STEADY_N) {
            tapHistCount++;
        }
        if (tapHistCount >= TAP_STEADY_N) {
            float lo = tapHist[0], hi = tapHist[0];
            float sum = 0;
            for (size_t i = 0; i < TAP_STEADY_N; i++) {
                if (tapHist[i] < lo) lo = tapHist[i];
                if (tapHist[i] > hi) hi = tapHist[i];
                sum += tapHist[i];
            }
            if (hi - lo < TAP_STEADY_RANGE) {
                // Five stable samples: refresh the baseline (follows a scale
                // that has settled on a new weight).
                tapSteady = true;
                tapBaseline = sum / TAP_STEADY_N;
            } else {
                tapSteady = false; // window unstable, keep the old baseline
            }
        }
    }

    // --- Local peak detection -> sequence counting -------------------------
    // Peaks are accepted only once a baseline has been established (first
    // five samples), so a stray transient on boot can't pass the height gate.
    // tapSteady itself is NOT required here — the first tap of a gesture is a
    // > 2 g deviation that already clears tapSteady; the baseline stays valid
    // until the weight settles again.
    const bool baselineReady = tapHistCount >= TAP_STEADY_N;
    if (baselineReady && w > tapPrevW + TAP_PEAK_SLOPE) {
        tapRising = true;
    } else if (w < tapPrevW - TAP_PEAK_SLOPE && tapRising) {
        tapRising = false;
        float height = tapPrevW - tapBaseline;
        if (baselineReady && height > peakG) {
            if (now - tapLastPeakMs < windowMs) {
                tapSeqCount++;
                if (tapSeqCount >= 3) {
                    // Triple tap: cancel the pending double decision and fire
                    // the timer action immediately; start a fresh sequence.
                    tapDecisionPending = false;
                    tapSeqCount = 0;
                    ESP_LOGI(LOG_TAG, "Triple tap detected -> timer");
                    fireAction(true);
                } else {
                    // Peak 2: open the decision window to tell double/triple
                    // apart (a third peak within the window overrides this).
                    tapDecisionPending = true;
                    tapDecisionAtMs = now;
                }
            } else {
                tapSeqCount = 1; // first tap of a new sequence
            }
            tapLastPeakMs = now;
        }
    }
    tapPrevW = w;

    // --- Window expired without a third peak -> double tap, fire now --------
    // The decision window is the only delay: unlike the triple tap (which
    // fires on the third peak), the double tap can only be told apart from a
    // triple by waiting out the window, after which it fires immediately.
    if (tapDecisionPending && now - tapDecisionAtMs >= windowMs) {
        tapDecisionPending = false;
        tapSeqCount = 0;
        ESP_LOGI(LOG_TAG, "Double tap detected -> tare");
        fireAction(false);
    }
}

void DoubleTapTarePlugin::fireAction(bool triple) {
    Settings &settings = controller->getSettings();

    // Master switch gates the whole plugin; each gesture has its own toggle.
    if (!settings.isDoubleTapTareEnabled()) {
        return;
    }

    if (triple) {
        if (!settings.isTripleTapTimerEnabled() || !BLEScales.hasTimerControl()) {
            return;
        }
        switch (tapTripleSeq) {
            case 0:
                BLEScales.startTimer();
                ESP_LOGI(LOG_TAG, "Timer START");
                break;
            case 1:
                BLEScales.stopTimer();
                ESP_LOGI(LOG_TAG, "Timer STOP");
                break;
            default:
                BLEScales.resetTimer();
                ESP_LOGI(LOG_TAG, "Timer RESET");
                break;
        }
        tapTripleSeq = (tapTripleSeq + 1) % 3;
    } else {
        if (!settings.isDoubleTapTareActionEnabled()) {
            return;
        }
        BLEScales.tare();
        ESP_LOGI(LOG_TAG, "TARE by double tap");
    }
}
