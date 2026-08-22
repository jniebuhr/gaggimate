#include "mathutils.h"
#include <Arduino.h>
#include <cmath>

float round_to(float x, int n) {
    float multiplier = std::pow(10.0f, n);
    return std::round(x * multiplier) / multiplier;
}
