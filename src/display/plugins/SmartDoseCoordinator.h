#pragma once
#include <cmath>
#include <cstdint>

// Pure dosing state machine. The plugin serializes calls under its process/plugin
// locks; actions are consumed once by the caller, never by a second scale callback.
namespace smartdose {
static constexpr float ZERO_TOLERANCE_G = 0.2f;
static constexpr float ACCESSORY_WEIGHT_TOLERANCE_G = 1.0f;
static constexpr uint32_t STABILITY_MS = 500;
static constexpr uint32_t REMOVAL_CONFIRM_MS = 300;
static constexpr uint32_t TRANSITION_GRACE_MS = 1500;
static constexpr uint32_t READING_STALE_MS = 1500;
enum class Accessory { NONE, CUP, PORTAFILTER };
enum class Mode { NONE, CUP, AUTOMATIC, PORTAFILTER };
enum class Phase { IDLE, TARING, FILLING, READY, REMOVING };
struct Config {
    bool cupEnabled = true, pfEnabled = true, automatic = false;
    bool cupHardware = false, pfHardware = false;
    float cup = 0, pf = 0;
    Mode preference = Mode::NONE;
    bool operator==(const Config &b) const {
        return cupEnabled == b.cupEnabled && pfEnabled == b.pfEnabled && automatic == b.automatic &&
               cupHardware == b.cupHardware && pfHardware == b.pfHardware && cup == b.cup && pf == b.pf &&
               preference == b.preference;
    }
    bool cupReady() const { return cupEnabled && std::isfinite(cup) && cup > 0 && cup <= 2000; }
    bool pfReady() const { return pfEnabled && std::isfinite(pf) && pf > 0 && pf <= 2000; }
    bool autoReady() const { return cupReady() && pfReady() && (cupHardware != pfHardware || cup + 1.2f < pf + 5.0f - 0.2f); }
    Mode mode() const {
        if (preference == Mode::AUTOMATIC && autoReady())
            return preference;
        if (preference == Mode::CUP && cupReady())
            return preference;
        if (preference == Mode::PORTAFILTER && pfReady())
            return preference;
        if (autoReady())
            return Mode::AUTOMATIC;
        if (cupReady())
            return Mode::CUP;
        if (pfReady())
            return Mode::PORTAFILTER;
        return Mode::NONE;
    }
};
inline bool validDose(float v) { return std::isfinite(v) && v >= 5 && v <= 40; }
struct Reading {
    float weight = 0, anchor = 0, baseline = 0;
    uint32_t last = 0, stableSince = 0;
    bool present = false, baselineReady = false;
    bool fresh(uint32_t now) const { return present && now - last < READING_STALE_MS; }
    bool stable(uint32_t now, uint32_t duration = STABILITY_MS) const { return fresh(now) && now - stableSince >= duration; }
    void update(float v, uint32_t now) {
        if (!fresh(now) || std::abs(v - anchor) > .2f) {
            anchor = v;
            stableSince = now;
        }
        weight = v;
        last = now;
        present = true;
    }
};
struct Action {
    bool tare = false, capture = false;
    bool hardware = false;
    float dose = 0;
};
class Coordinator {
  public:
    Config config;
    Reading readings[2];
    Accessory owner = Accessory::NONE;
    Phase phase = Phase::IDLE;
    float candidate = 0, tareBaseline = 0;
    bool ownerHardware = false;
    uint32_t started = 0, removalStarted = 0, transitionStarted = 0;
    bool transitionPending = false;
    bool tareIssued = false;

    void cancel() {
        owner = Accessory::NONE;
        phase = Phase::IDLE;
        candidate = 0;
        tareIssued = false;
        transitionPending = false;
        // Require a fresh stable reference before another placement can claim ownership.
        for (auto &r : readings)
            r = Reading{};
    }
    void configure(const Config &next) {
        if (!(config == next)) {
            cancel();
            config = next;
        }
    }
    void tick(uint32_t now, bool allowed, bool bluetoothHealthy, bool hardwareHealthy) {
        bool healthy[2] = {bluetoothHealthy, hardwareHealthy};
        if (!allowed) {
            cancel();
            return;
        }
        if (owner != Accessory::NONE && (!healthy[ownerHardware] || !readings[ownerHardware].fresh(now))) {
            cancel();
            return;
        }
        for (int i = 0; i < 2; ++i) {
            if (!healthy[i] || !readings[i].fresh(now))
                readings[i] = Reading{};
        }
    }
    Action sample(float value, bool hardware, uint32_t now) {
        Action action;
        if (owner != Accessory::NONE && hardware != ownerHardware)
            return action;
        auto &r = readings[hardware];
        if (!std::isfinite(value)) {
            if (owner != Accessory::NONE)
                cancel();
            else
                r = Reading{};
            return action;
        }
        if (!r.fresh(now)) {
            if (owner != Accessory::NONE)
                cancel();
            r = Reading{};
        }
        r.update(value, now);
        if (owner == Accessory::NONE) {
            if (!r.stable(now))
                return action;
            if (!r.baselineReady) {
                r.baseline = value;
                r.baselineReady = true;
                return action;
            }
            const auto mode = config.mode();
            const bool cup = config.automatic && config.cupHardware == hardware && (mode == Mode::CUP || mode == Mode::AUTOMATIC);
            const bool pf =
                config.automatic && config.pfHardware == hardware && (mode == Mode::PORTAFILTER || mode == Mode::AUTOMATIC);
            const float added = value - r.baseline;
            if (cup && std::abs(added - config.cup) <= ACCESSORY_WEIGHT_TOLERANCE_G) {
                // Placement is relative to the previous stable weight, including
                // a negative offset left by the last cup tare.
                return startCupTare(hardware, now, r.baseline, value);
            } else if (pf && validDose(added - config.pf)) {
                claim(Accessory::PORTAFILTER, hardware, Phase::READY);
                candidate = added - config.pf;
            } else if (pf && std::abs(added - config.pf) <= ACCESSORY_WEIGHT_TOLERANCE_G) {
                // Keep the pre-placement reference if beans will be added to an
                // empty PF, without showing a cycle until a valid dose is present.
                return action;
            } else if (cup && validDose(r.baseline) && value < -ZERO_TOLERANCE_G) {
                // The scale may have powered on with the cup already tared.
                // Preserve the stable net dose while lifting crosses negative
                // readings. Only the calibrated empty reading confirms removal.
                const float dose = r.baseline;
                const bool removed = std::abs(value + config.cup) <= ACCESSORY_WEIGHT_TOLERANCE_G;
                claim(Accessory::CUP, hardware, removed ? Phase::REMOVING : Phase::READY);
                candidate = dose;
                r.baseline = -config.cup;
                removalStarted = now;
                transitionPending = !removed;
                transitionStarted = now;
            } else {
                r.baseline = value;
            }
            return action;
        }
        if (phase == Phase::TARING) {
            if (tareIssued && std::abs(value) <= ZERO_TOLERANCE_G) {
                phase = Phase::FILLING;
                r.stableSince = now;
                r.baseline = tareBaseline;
            } else if (now - started > 5000)
                cancel();
            return action;
        }

        // A scale-side tare from -cup to zero can look like placement. If an
        // empty cup is subsequently added, tare it before accepting any beans.
        if (owner == Accessory::CUP && value > 40 && !validDose(candidate) && r.stable(now) &&
            std::abs(value - config.cup) <= ACCESSORY_WEIGHT_TOLERANCE_G)
            return startCupTare(hardware, now, 0, value);

        // Both accessories return to their retained empty reference on removal.
        const float tolerance = owner == Accessory::CUP ? ACCESSORY_WEIGHT_TOLERANCE_G : ZERO_TOLERANCE_G;
        if (std::abs(value - r.baseline) <= tolerance) {
            transitionPending = false;
            if (phase != Phase::REMOVING) {
                phase = Phase::REMOVING;
                removalStarted = now;
            }
            if (now - removalStarted >= REMOVAL_CONFIRM_MS) {
                action.capture = validDose(candidate);
                action.dose = candidate;
                action.hardware = hardware;
                cancel();
            }
            return action;
        }

        const float dose = owner == Accessory::CUP ? value : value - r.baseline - config.pf;
        if (validDose(dose)) {
            transitionPending = false;
            phase = r.stable(now) ? Phase::READY : Phase::FILLING;
            if (r.stable(now))
                candidate = dose;
        } else if (dose > 40 ||
                   (dose >= -ZERO_TOLERANCE_G && r.stable(now) && (owner == Accessory::CUP || !validDose(candidate)))) {
            // Empty/underfilled or overfilled accessories have no valid dose.
            candidate = 0;
            phase = Phase::FILLING;
            transitionPending = false;
        } else if (validDose(candidate)) {
            // Preserve the last stable dose while lifting traverses other weights.
            phase = Phase::READY;
            if (!transitionPending) {
                transitionPending = true;
                transitionStarted = now;
            }
            if (now - transitionStarted >= TRANSITION_GRACE_MS)
                cancel();
        } else {
            phase = Phase::FILLING;
        }
        return action;
    }

  private:
    Action startCupTare(bool hardware, uint32_t now, float baseline, float weight) {
        claim(Accessory::CUP, hardware, Phase::TARING);
        started = now;
        tareBaseline = baseline - weight;
        Action action;
        action.tare = true;
        action.hardware = hardware;
        return action;
    }

    void claim(Accessory accessory, bool hardware, Phase next) {
        owner = accessory;
        ownerHardware = hardware;
        phase = next;
        candidate = 0;
        tareIssued = false;
        transitionPending = false;
        // Ignored placements on the other scale must establish a new reference.
        for (auto &r : readings)
            r.baselineReady = false;
    }
};
} // namespace smartdose
