#pragma once
#include <cmath>
#include <cstdint>

// Pure dosing state machine. The plugin serializes calls under its process/plugin
// locks; actions are consumed once by the caller, never by a second scale callback.
namespace smartdose {
static constexpr float ZERO_TOLERANCE_G = 0.2f;
static constexpr float CUP_WEIGHT_TOLERANCE_G = 1.0f;
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
    bool autoReady() const {
        return cupReady() && pfReady() && (cupHardware != pfHardware || (cup < pf && cup + 1.2f < pf + 5.0f - 0.2f));
    }
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
    bool present = false, armed = false, cupArmed = false;
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
        // Cached/ignored placements cannot claim ownership after release. A new cup
        // cycle requires a fresh stable zero, then the calibrated cup weight.
        for (auto &r : readings) {
            r.armed = false;
            r.cupArmed = false;
            r.present = false;
        }
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
            if (!healthy[i] || !readings[i].fresh(now)) {
                readings[i].present = false;
                readings[i].armed = false;
                readings[i].cupArmed = false;
                if (!healthy[i])
                    readings[i].baseline = 0;
            }
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
            r.armed = false;
            r.cupArmed = false;
        }
        r.update(value, now);
        if (owner == Accessory::NONE) {
            // Only a reported zero arms cup detection. A negative empty-scale
            // tare offset from the previous cycle must never make zero look
            // like a newly placed cup. Stable zero establishes the new baseline.
            if (std::abs(value) <= ZERO_TOLERANCE_G && r.stable(now)) {
                r.baseline = 0;
                r.cupArmed = true;
            }
            if (std::abs(value - r.baseline) <= ZERO_TOLERANCE_G && r.stable(now))
                r.armed = true;
            if (!config.automatic || !r.stable(now))
                return action;
            const auto mode = config.mode();
            if ((mode == Mode::CUP || mode == Mode::AUTOMATIC) && config.cupHardware == hardware && r.cupArmed &&
                std::abs(value - config.cup) <= CUP_WEIGHT_TOLERANCE_G && std::abs(value) > ZERO_TOLERANCE_G) {
                owner = Accessory::CUP;
                phase = Phase::TARING;
                candidate = 0;
                started = now;
                tareIssued = false;
                tareBaseline = r.baseline - value;
                action.tare = true;
                action.hardware = hardware;
            } else if ((mode == Mode::PORTAFILTER || mode == Mode::AUTOMATIC) && config.pfHardware == hardware && r.armed &&
                       validDose(value - r.baseline - config.pf)) {
                owner = Accessory::PORTAFILTER;
                phase = Phase::READY;
                candidate = value - r.baseline - config.pf;
            } else
                return action;
            ownerHardware = hardware;
            for (auto &other : readings) {
                other.armed = false;
                other.cupArmed = false;
            }
            return action;
        }
        if (owner == Accessory::CUP) {
            if (phase == Phase::TARING) {
                if (tareIssued && std::abs(value) <= ZERO_TOLERANCE_G) {
                    phase = Phase::FILLING;
                    r.stableSince = now;
                    // A cup tare shifts the empty physical scale to -cupWeight.
                    // Retain that known baseline across cycles, including shared-scale PF weighing.
                    r.baseline = tareBaseline;
                } else if (now - started > 5000)
                    cancel();
                return action;
            }
            if (value < -std::fmax(2.0f, config.cup * .5f)) {
                if (phase != Phase::REMOVING) {
                    phase = Phase::REMOVING;
                    removalStarted = now;
                }
                if (now - removalStarted >= REMOVAL_CONFIRM_MS) {
                    action.capture = validDose(candidate);
                    action.dose = candidate;
                    cancel();
                }
                return action;
            }
            phase = Phase::FILLING;
            if (validDose(value) && r.stable(now))
                candidate = value;
            else if (value > 40)
                candidate = 0;
            return action;
        }
        if (std::abs(value - r.baseline) <= ZERO_TOLERANCE_G) {
            transitionPending = false;
            if (phase != Phase::REMOVING) {
                phase = Phase::REMOVING;
                removalStarted = now;
            }
            if (now - removalStarted >= REMOVAL_CONFIRM_MS) {
                action.capture = validDose(candidate);
                action.dose = candidate;
                cancel();
            }
        } else if (validDose(value - r.baseline - config.pf)) {
            transitionPending = false;
            phase = Phase::READY;
            if (r.stable(now))
                candidate = value - r.baseline - config.pf;
        } else {
            // Lifting the portafilter traverses weights outside the dose range.
            // Preserve the established stable dose briefly, but cancel sustained
            // invalid readings. Empty confirmation starts only on reaching zero.
            phase = Phase::READY;
            if (!validDose(candidate)) {
                cancel();
                return action;
            }
            if (!transitionPending) {
                transitionPending = true;
                transitionStarted = now;
            }
            if (now - transitionStarted >= TRANSITION_GRACE_MS)
                cancel();
        }
        return action;
    }
};
} // namespace smartdose
