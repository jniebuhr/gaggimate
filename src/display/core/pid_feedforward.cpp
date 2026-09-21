#include "pid_feedforward.h"

#include <cstdio>
#include <cstdlib>

namespace {
std::string trim(const std::string &value) {
    const auto start = value.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) {
        return "";
    }
    const auto end = value.find_last_not_of(" \t\r\n");
    return value.substr(start, end - start + 1);
}

// First four CSV fields. Same walk as parseFloatCsv in Controller.cpp:
// indexOf(',') / substring, stopping at the first missing comma. count includes
// a blank field, so "a,b,c," is four fields with an empty Kff.
struct PidTerms {
    std::string kp;
    std::string ki;
    std::string kd;
    std::string kf;
    int count = 0;
};

PidTerms parsePid(const std::string &csv) {
    PidTerms pid;
    std::string *const fields[] = {&pid.kp, &pid.ki, &pid.kd, &pid.kf};
    std::size_t start = 0;
    for (int i = 0; i < 4; ++i) {
        if (start > csv.size()) {
            break;
        }
        const std::size_t comma = csv.find(',', start);
        const std::string token =
            comma == std::string::npos ? csv.substr(start) : csv.substr(start, comma - start);
        *fields[i] = trim(token);
        pid.count = i + 1;
        if (comma == std::string::npos) {
            break;
        }
        start = comma + 1;
    }
    return pid;
}

std::string formatPid(const PidTerms &pid) {
    std::string out = pid.kp + "," + pid.ki + "," + pid.kd;
    if (!pid.kf.empty()) {
        out += "," + pid.kf;
    }
    return out;
}
} // namespace

std::string mergePidKeepingFeedforward(const std::string &existing, const std::string &incoming) {
    const PidTerms in = parsePid(incoming);
    if (in.count < 3) {
        return incoming;
    }
    PidTerms out = in;
    if (out.kf.empty()) {
        out.kf = parsePid(existing).kf;
    }
    return formatPid(out);
}

std::string formatAutotunePid(float kp, float ki, float kd, float kf, bool &feedforwardSkipped) {
    char buf[64];
    // Wattage 0 arrives as kf == 0. Leave Kff off the string so a later merge
    // keeps whatever was already stored. An explicit 0 from settings still
    // clears it, because that path sends a 4th field.
    feedforwardSkipped = kf == 0.0f;
    const char *format = feedforwardSkipped ? "%.3f,%.3f,%.3f" : "%.3f,%.3f,%.3f,%.3f";
    std::snprintf(buf, sizeof(buf), format, kp, ki, kd, kf);
    return buf;
}

float pidFeedforwardGain(const std::string &pid) {
    const std::string kf = parsePid(pid).kf;
    if (kf.empty()) {
        return 0.0f;
    }
    return std::strtof(kf.c_str(), nullptr);
}
