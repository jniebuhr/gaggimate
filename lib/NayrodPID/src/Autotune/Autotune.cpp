#include "Autotune.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <numeric>

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

Autotune::Autotune() { reset(); }

void Autotune::reset() {
    values.clear();
    times.clear();
    slopes.clear();
    slopeTimes.clear();
    allSlopes.clear();
    allSlopeTimes.clear();
    currentConfirmations = 0;
    reactionDetected = false;
    maxSlopeFound = false;
    finished = false;
    timedOut = false;
    initialSlope = 0.0f;
    maxPowerOn = false;
    system_pure_delay = 0.0f;
    system_gain = 0.0f;
    system_tau2 = 0.0f;
    Kp = Ki = Kd = Kff = 0.0f;
}

// Per-sample entry point (temperature + wall-clock time in seconds).
// Dispatches the state machine through primeBaselineSlope /
// handlePreReactionSample / handlePostReactionSample / finalizeInflection.
// Stays short and reads top-down; each helper owns one phase.
void Autotune::update(float temperature, float currentTime) {
    if (finished)
        return;
    if (values.empty())
        initialTemp = temperature;

    values.push_back(temperature);
    times.push_back(currentTime);

    // Phase 1 — priming the initial window. Collect samples; on the Nth,
    // freeze baseline slope + flip maxPowerOn for the Heater.
    if (values.size() <= N) {
        primeBaselineSlope(currentTime);
        return;
    }

    // Phases 2-3 — every subsequent sample. Compute rolling slope, push to
    // both the bounded inflection window and the full transient history
    // identifyTau2 needs later.
    const std::deque<float> windowTimes(times.end() - N, times.end());
    const std::deque<float> windowValues(values.end() - N, values.end());
    const float slope = computeSlope(windowTimes, windowValues);
    allSlopes.push_back(slope);
    allSlopeTimes.push_back(currentTime);

    if (!reactionDetected) {
        handlePreReactionSample(slope, currentTime);
    } else {
        handlePostReactionSample(slope, currentTime, temperature);
    }

    // Drop oldest entry — keep rolling window bounded.
    values.pop_front();
    times.pop_front();
}

void Autotune::primeBaselineSlope(float currentTime) {
    if (values.size() != N)
        return; // still accumulating baseline

    const std::deque<float> windowTimes(times.end() - N, times.end());
    const std::deque<float> windowValues(values.end() - N, values.end());
    initialSlope = computeSlope(windowTimes, windowValues);

    // Signal Heater to apply full-power step + freeze t=0 for all
    // downstream dead-time / inflection math.
    maxPowerOn = true;
    startPowerOnTime = currentTime;
}

void Autotune::handlePreReactionSample(float slope, float currentTime) {
    // Timeout without sustained motion → abort.
    const bool timedOutWaiting = (currentTime - startPowerOnTime) > maxTimeOut_s;

    if (slope > initialSlope + epsilon) {
        currentConfirmations++;
        if (currentConfirmations >= requiredConfirmations) {
            reactionDetected = true;
            // Unsigned-underflow guard: if requiredConfirmations was set
            // above the times window, fall back to oldest sample we have.
            const size_t off = requiredConfirmations <= times.size() ? requiredConfirmations : times.size();
            reactionTime = times[times.size() - off];
        }
        return;
    }

    // Single-sample dip below epsilon resets streak; overall timeout still
    // governs the phase.
    currentConfirmations = 0;
    if (timedOutWaiting) {
        timedOut = true;
        finished = true;
    }
}

void Autotune::handlePostReactionSample(float slope, float currentTime, float temperature) {
    slopes.push_back(slope);
    slopeTimes.push_back(currentTime);

    // Timeout in post-reaction too — some plants (or a frozen sensor) keep
    // emitting slopes without saturating.
    if ((currentTime - startPowerOnTime) > maxTimeOut_s) {
        timedOut = true;
        finished = true;
        return;
    }

    // Not enough slope samples for inflection check yet.
    if (slopes.size() < N)
        return;

    // Inflection: slopeOfSlope ≈ 0 (slope saturated at k') AND temp rose ≥
    // 10 °C from start (guard against saturating on flat noise floor).
    const float slopeOfSlope = computeSlope(slopeTimes, slopes);
    const bool inflected = slopeOfSlope < 0.05f && !maxSlopeFound && temperature > initialTemp + 10.0f;
    if (inflected) {
        const auto maxIt = std::max_element(slopes.begin(), slopes.end());
        system_gain = *maxIt;
        maxSlopeTime = slopeTimes[std::distance(slopes.begin(), maxIt)];
        maxSlopeFound = true;
        finished = true;
        finalizeInflection();
    }

    // Keep slope window bounded.
    slopes.pop_front();
    slopeTimes.pop_front();
}

void Autotune::finalizeInflection() {
    system_pure_delay = reactionTime - startPowerOnTime;
    system_tau2 = identifyTau2(system_gain);
    computeControllerGains(system_pure_delay, system_gain, system_tau2);
}

void Autotune::computeControllerGains(float L, float k_prime, float tau2) {
    // SIMC PID for integrator+lag plants (Skogestad 2003, J. Process Control
    // 13:291, Eq. 23). Thermal plants with dominant slow pole + small parasitic
    // second lag look integrating on control horizon. FOPDT rules
    // (ZN/Cohen-Coon/AMIGO/Lambda/No-Overshoot) collapse Kd→0 — single-lag fit,
    // no second time constant to drive derivative.
    //
    // Parallel-form rule:
    //   Kc = 1 / (k' · (τc + L))
    //   Ti = 4 · (τc + L)
    //   Td = τ2
    // τc = 1.5·L ("smooth robust" per Skogestad). Heater callsite ×1000 scales
    // raw gains into SimplePID ms-of-window units; clamps below are pre-scale.
    //
    // Degenerate inputs zero out; Heater timeout guard skips pid_callback.
    if (!std::isfinite(L) || L <= 0.0f || !std::isfinite(k_prime) || k_prime <= 1e-4f) {
        Kp = Ki = Kd = Kff = 0.0f;
        cross_freq = 0.0f;
        return;
    }

    const float tauC = 1.5f * L;
    const float Kc = 1.0f / (k_prime * (tauC + L));
    const float Ti = 4.0f * (tauC + L);
    const float Td = (tau2 > 0.0f && std::isfinite(tau2)) ? tau2 : 0.2f * L;

    Kp = Kc;
    Kd = Kc * Td;
    Kff = 1.0f / k_prime; // feedforward; legacy semantics

    // Sanity clamp (Skogestad guardrails + empirical envelope, espresso-class
    // thermal plants). ×1000 in Heater ⇒ physical Kp ∈ [20,300], Kd ∈ [50,800].
    Kp = std::min(std::max(Kp, 0.02f), 0.30f);
    Kd = std::min(std::max(Kd, 0.05f), 0.80f);
    // Derive Ki from clamped Kp — preserves SIMC Ki = Kp/Ti invariant when
    // clamp triggers on extreme IDs (small k' or L blows Kc up). Un-clamped
    // Kc gave windup-class integrator term mismatched with delivered Kp (#672).
    Ki = Kp / Ti;
    if (!std::isfinite(Ki) || Ki < 0.0f)
        Ki = 0.0f;

    // cross_freq retained for log back-compat; approx PID crossover from SIMC
    // time scales.
    cross_freq = 1.0f / (2.0f * M_PI * (tauC + L));
}

float Autotune::identifyTau2(float k_prime) {
    // Exponential peeling (Riggleman 1947; Mukherjee 2024). Integrator+lag
    // step response post-dead-time slope:
    //   slope(t) = k' · (1 - e^{-(t-L)/τ₂})
    //   ⇒  ln(k' - slope(t)) = ln(k') - (t - L)/τ₂
    // Log-linear regression of ln(k' - slope) vs t has slope = -1/τ₂. L
    // offset shifts intercept, not slope. Best in τ₂/L « 1 regime — typical
    // of metal-shell thermocouple externally mounted on water boiler.
    //
    // Fallback τ₂ = 0.2·L when sample set sparse, k' too small, or arithmetic
    // produces implausible τ₂.
    const float fallback = 0.2f * system_pure_delay;
    if (allSlopes.size() < 8 || k_prime <= 1e-4f || allSlopeTimes.empty()) {
        return fallback;
    }

    // Informative band: slope deficit ∈ [5 %, 95 %] of k'. Quantisation +
    // near-saturation samples destabilise fit.
    const float lo_deficit = 0.05f * k_prime;
    const float hi_deficit = 0.95f * k_prime;
    float sum_t = 0.0f;
    float sum_y = 0.0f;
    float sum_tt = 0.0f;
    float sum_ty = 0.0f;
    int n = 0;
    for (size_t i = 0; i < allSlopes.size(); ++i) {
        const float deficit = k_prime - allSlopes[i];
        if (deficit < lo_deficit || deficit > hi_deficit)
            continue;
        const float t = allSlopeTimes[i];
        const float y = std::log(deficit); // ln(k' - slope)
        sum_t += t;
        sum_y += y;
        sum_tt += t * t;
        sum_ty += t * y;
        ++n;
    }

    if (n < 4)
        return fallback;

    // LS slope of ln(k'-slope) vs t = -1/τ₂.
    const float denom = static_cast<float>(n) * sum_tt - sum_t * sum_t;
    if (std::abs(denom) < 1e-6f)
        return fallback;
    const float regression_slope = (static_cast<float>(n) * sum_ty - sum_t * sum_y) / denom;
    if (!std::isfinite(regression_slope) || regression_slope >= 0.0f) {
        // Non-negative slope ⇒ (k'-slope) flat or growing — plant not
        // integrator+lag-shaped. Fall back to empirical.
        return fallback;
    }

    const float tau2 = -1.0f / regression_slope;
    // Plausibility: τ₂ ∈ (0.5, L). <0.5 s sub-sample-rate (1 Hz); >L means
    // fast pole slower than dead time — outside integrator+lag regime.
    if (!std::isfinite(tau2) || tau2 < 0.5f || tau2 > system_pure_delay) {
        return fallback;
    }
    return tau2;
}

float Autotune::computeSlope(const std::deque<float> &x, const std::deque<float> &y) const {
    // LS line fit over data cloud — robust derivative on noisy quantised
    // signal vs raw diff + filter.
    int n = x.size();
    if (n < 2)
        return 0.0f;

    const float sum_x = std::accumulate(x.begin(), x.end(), 0.0f);
    const float sum_y = std::accumulate(y.begin(), y.end(), 0.0f);
    float sum_xx = 0.0f;
    float sum_xy = 0.0f;

    for (int i = 0; i < n; ++i) {
        sum_xx += x[i] * x[i];
        sum_xy += x[i] * y[i];
    }

    float denom = n * sum_xx - sum_x * sum_x;
    if (denom == 0.0f)
        return 0.0f;

    return (n * sum_xy - sum_x * sum_y) / denom;
}

// Setter guards bound args to plausible ranges. Caller passing 0/negative
// (e.g. malformed BLE msg) previously wedged autotune in never-finishes
// state — setters now snap to safe floor.
void Autotune::setupAutotune(unsigned int windowSize, float slopeThreshold, unsigned int confirmationCount) {
    setWindowsize(windowSize);
    setEpsilon(slopeThreshold);
    setRequiredConfirmations(confirmationCount);
}

void Autotune::setWindowsize(unsigned int size) { N = size < 2 ? 2 : size; }

void Autotune::setEpsilon(float eps) { epsilon = (eps > 0.0f && std::isfinite(eps)) ? eps : 0.1f; }

void Autotune::setRequiredConfirmations(unsigned int confirmations) {
    requiredConfirmations = confirmations < 2 ? 2 : confirmations;
}

void Autotune::setTimeOut(float timeOut) { maxTimeOut_s = (timeOut > 0.0f && std::isfinite(timeOut)) ? timeOut : 120.0f; }

bool Autotune::isFinished() const { return finished; }
float Autotune::getKp() const { return Kp; }
float Autotune::getKi() const { return Ki; }
float Autotune::getKd() const { return Kd; }
float Autotune::getKff() const { return Kff; }
