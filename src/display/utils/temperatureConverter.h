#pragma once
#ifndef TEMPERATURE_CONVERTER_H
#define TEMPERATURE_CONVERTER_H

#include <cmath>

/**
 * Convert Celsius to Fahrenheit
 * @param celsius Temperature in Celsius
 * @return Temperature in Fahrenheit
 */
inline float celsiusToFahrenheit(float celsius) {
    return (celsius * 9.0f / 5.0f) + 32.0f;
}

/**
 * Convert Fahrenheit to Celsius
 * @param fahrenheit Temperature in Fahrenheit
 * @return Temperature in Celsius
 */
inline float fahrenheitToCelsius(float fahrenheit) {
    return (fahrenheit - 32.0f) * 5.0f / 9.0f;
}

/**
 * Format temperature display with appropriate unit
 * @param tempCelsius Temperature in Celsius (from backend)
 * @param useFahrenheit Whether to display in Fahrenheit
 * @param precision Number of decimal places (default: 0)
 * @return Formatted temperature value for display
 */
inline float formatTemperatureForDisplay(float tempCelsius, bool useFahrenheit, int precision = 0) {
    if (useFahrenheit) {
        return celsiusToFahrenheit(tempCelsius);
    }
    return tempCelsius;
}

/**
 * Get temperature unit symbol
 * @param useFahrenheit Whether to use Fahrenheit
 * @return Unit symbol
 */
inline const char* getTemperatureUnit(bool useFahrenheit) {
    return useFahrenheit ? "°F" : "°C";
}

#endif // TEMPERATURE_CONVERTER_H
