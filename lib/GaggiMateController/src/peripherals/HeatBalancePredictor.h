#ifndef HEATBALANCEPREDICTOR_H
#define HEATBALANCEPREDICTOR_H

#include <algorithm>
#include <cmath>
#include <deque>

// Smith-predictor style lag compensation for a boiler whose thermocouple sees heater power only after a
// dead time. It integrates a heat balance (heater in; fresh water and standing losses out) and reports the
// part of it the sensor hasn't seen yet, so the PID can run on measured + correction instead of a reading
// that is ~20 s old. Only the model's last dead-time window is used, so model errors cannot accumulate.
//
// Parameters come straight from a full-power heat-up: heater wattage, the steady heating rate it produces
// (°C/s, autotune's k') and the dead time before the sensor reacts. Heat capacity = wattage / rate.
//
// Water drawn in by a flush or shot reaches the sensor sooner than heater heat: on a Silvia the dip starts after ~5 s
// and is half way down by ~12 s, while heater heat takes ~20 s. With one shared delay the predictor keeps counting a
// flush the sensor already shows, i.e. counts it twice, and over-heats; so water has its own delay. Set it to about the
// half-way time: a delay as short as the first reaction drops the flush while the sensor is still falling.
class HeatBalancePredictor {
  public:
    static constexpr float WATER_SPECIFIC_HEAT = 4.18f; // J/(g·°C), 1 ml = 1 g
    static constexpr float MAX_CORRECTION = 15.0f;      // °C, bound on how far the prediction may lead the sensor
    // s, longest step counted: the heater steps once a second, so a longer gap is time the predictor wasn't running
    // (switched off in the settings), not heat. Counted whole, 13 min of standing loss once read as a 15 °C shortfall
    // and the heat-up boost ran flat out at the setpoint (bench, 2026-11-03).
    static constexpr float MAX_STEP_S = 5.0f;
    static constexpr float LOSS_LEARN_BAND = 1.0f;        // °C, losses are only learned this close to setpoint
    static constexpr float LOSS_LEARN_TAU = 300.0f;       // s, time constant of the standing-loss estimate
    static constexpr float DEFAULT_LOSS_FRACTION = 0.05f; // first-run loss guess: ~5 % of the element at brew temp
    // The standing loss is learned per degree above the room, so brew and steam share one value. It is reported (and
    // seeded) in watts at LOSS_REFERENCE_DELTA_C above the room, i.e. at a 93 °C brew temperature in a 23 °C room.
    static constexpr float AMBIENT_C = 23.0f;
    static constexpr float LOSS_REFERENCE_DELTA_C = 70.0f;

    // Any parameter <= 0 disables the predictor (correction stays 0).
    // waterDeadTimeSeconds <= 0 uses deadTimeSeconds for water too (the original single-delay model).
    void configure(float watts, float fullPowerRate, float deadTimeSeconds, float inletTempC = 23.0f,
                   float waterDeadTimeSeconds = 0.0f);
    bool isEnabled() const { return heatCapacity > 0.0f; }
    float getDeadTime() const { return deadTime; }
    float getWaterDeadTime() const { return waterDeadTime; }
    void reset();
    // Starting point for the learned standing loss, applied once: a value saved from an earlier run, or <= 0 for
    // DEFAULT_LOSS_FRACTION of the heater. Starting from zero would read the holding power as heat in flight and
    // sag the boiler by ~deadTime x holding power / capacity until the loss is relearned.
    void seedLoss(float savedWatts);

    // Advance the model by dt seconds and return the correction (°C) to add to the measured temperature.
    // duty: heater on-fraction 0..1 over dt; flow: ml/s of fresh water entering the boiler.
    float update(float dt, float duty, float flow, float measuredTemp, float setpoint);
    float getCorrection() const { return correction; }
    float getLossWatts() const { return lossPerC * LOSS_REFERENCE_DELTA_C; } // at the reference temperature
    // Water the valve dumps into the drip tray as the flow stops (ml, <= 0 = none): boiler water the flow didn't count.
    void setValveDump(float ml) { valveDumpMl = ml > 0.0f ? ml : 0.0f; }
    float getLossWattsAt(float temp) const { return lossPerC * std::max(temp - AMBIENT_C, 0.0f); }

  private:
    struct Step {
        float dt;
        float heat;  // °C the heater (net of standing loss) added this step; reaches the sensor after deadTime
        float water; // °C fresh water removed this step; reaches the sensor after waterDeadTime
    };
    std::deque<Step> window; // the last max(deadTime, waterDeadTime) of model steps, oldest first
    float windowTime = 0.0f;
    float correction = 0.0f;
    float lossPerC = 0.0f; // W per °C above AMBIENT_C
    float valveDumpMl = 0.0f;
    bool lossSeeded = false;
    float lastFlow = 0.0f; // ml/s at the previous step: its fall to 0 is the valve's dump

    float heaterWatts = 0.0f;
    float heatCapacity = 0.0f; // J/°C
    float deadTime = 0.0f;
    float waterDeadTime = 0.0f;
    float inletTemp = 23.0f;
};

#endif // HEATBALANCEPREDICTOR_H
