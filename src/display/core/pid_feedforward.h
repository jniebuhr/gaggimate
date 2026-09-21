#pragma once

#include <string>

// PID is stored as "Kp,Ki,Kd,Kff". A settings save that omits Kff (blank field
// or a 3-value string) must keep the stored feedforward. An explicit 4th field,
// including 0, replaces it.
std::string mergePidKeepingFeedforward(const std::string &existing, const std::string &incoming);

// Autotune with heater wattage writes Kff = 1000/W. Wattage 0 yields kf == 0,
// which is "not measured" rather than "disable": return a 3-field string so
// mergePidKeepingFeedforward keeps the previous Kff. feedforwardSkipped is
// true in that case.
std::string formatAutotunePid(float kp, float ki, float kd, float kf, bool &feedforwardSkipped);

// 4th CSV field, or 0 when feedforward was never stored. This is the gain
// Controller::setPidSettings sends to Heater::setFeedforwardScale.
float pidFeedforwardGain(const std::string &pid);
