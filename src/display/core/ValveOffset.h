#ifndef VALVE_OFFSET_H
#define VALVE_OFFSET_H

#include <algorithm>
#include <cmath>
#include <display/core/constants.h>

// Flow-derived mushroom-valve pressure offset.
//
// On a machine with a spring-loaded mushroom valve (DeLonghi ECP/Stilosa and similar), system
// pressure during a shot is the valve's drop plus the pressure across the puck. The fixed
// Pressure Offset declares how much the valve takes, so stock pressure profiles can be used
// unmodified. But the valve is a regulator, not a fixed restriction: the pressure it absorbs is a
// function of the flow through it and grows with it. A constant is therefore correct at exactly
// one flow rate, and puck pressure drifts as flow changes through the shot.
//
// Two measured (pressure, flow) points define the line, and a third measurement at 100% pump duty
// bounds it. Calibration is done with no puck in the portafilter and the fixed offset at 0, so the
// transducer reading is the valve's drop.
//
// Kept free-standing and header-only so it has no Arduino or ESP-IDF dependency and can be unit
// tested natively (see test/test_valve_offset).
//
//   flow         current pump flow, g/s (the firmware's own estimate)
//   fixedOffset  the constant Pressure Offset setting, returned whenever the model is unusable
//   flowDerived  whether the user enabled the flow-derived mode
//   p1,f1,p2,f2  the two calibration points
//   pMax         the drop measured at 100% pump duty — the ceiling the offset is capped at
//
// Returns the offset in bar to add to the brew pressure target and subtract from readings.
//
// One rule governs every input: if the calibration is incomplete or implausible, fall back to the
// fixed offset rather than acting on a model that cannot be trusted. The settings page rejects bad
// values before they are stored, but the registry is also writable over the API and survives
// firmware downgrades, so nothing here trusts what it is handed. Note that nothing downstream
// clamps the commanded setpoint.
inline float valveOffsetAt(float flow, float fixedOffset, bool flowDerived, float p1, float f1, float p2, float f2, float pMax) {
    if (!flowDerived)
        return fixedOffset;
    if (!std::isfinite(p1) || !std::isfinite(f1) || !std::isfinite(p2) || !std::isfinite(f2))
        return fixedOffset;
    // Zero is the uncalibrated default for the flows, not a measurement: a valve passes nothing
    // only at or below its cracking pressure, which is no use as the lower end of the line. The
    // registry is writable a field at a time, so without this a line could be fitted through an
    // f1 nobody ever set.
    if (!(f1 > 0.0f))
        return fixedOffset;
    // The same for the first pressure, and for the same reason: a cleared field reaches the
    // registry as 0, since String::toFloat() renders "" as zero. Nothing else reliably catches
    // it — p2 > p1 is satisfied by any positive p2, so only the slope band stands in the way,
    // and a wide span passes it. p1=0, f1=1, p2=5, f2=4 yields 1.67 bar per g/s and an offset
    // fitted through a point nobody measured. A valve's first point sits above its cracking
    // pressure, so zero is never one. This also anchors the chain: p2 > p1 and pMax > p2 then
    // make every pressure positive.
    if (!(p1 > 0.0f))
        return fixedOffset;
    if (!(f2 > f1) || !(p2 > p1))
        return fixedOffset;
    const float slope = (p2 - p1) / (f2 - f1);
    if (slope < VALVE_CAL_MIN_SLOPE || slope > VALVE_CAL_MAX_SLOPE)
        return fixedOffset;
    // The ceiling is required, not optional: the line is unbounded upward and the machine is not,
    // so without it the model asks for a drop the pump cannot produce. A ceiling at or below the
    // second calibration point would clip a pressure the user actually measured, so it is treated
    // as uncalibrated rather than honoured.
    if (!std::isfinite(pMax) || !(pMax > p2))
        return fixedOffset;
    if (!std::isfinite(flow))
        return fixedOffset;
    // Flow below the first calibration point extrapolates back toward the valve's cracking
    // pressure, which is intended; clamping at zero only stops a negative reading inverting it.
    float offset = (p1 - slope * f1) + slope * std::max(0.0f, flow);
    offset = std::min(offset, pMax);
    // A restriction subtracts pressure; it never adds it. The permitted slope band allows
    // calibrations whose line is negative at low flow, so the floor is not theoretical.
    return std::max(0.0f, offset);
}

#endif // VALVE_OFFSET_H
