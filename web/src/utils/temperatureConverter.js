/**
 * Temperature conversion utilities
 * All backend operations use Celsius, frontend can display in Fahrenheit
 */

/**
 * Convert Celsius to Fahrenheit
 * @param {number} celsius - Temperature in Celsius
 * @returns {number} Temperature in Fahrenheit (rounded to nearest integer)
 */
export function celsiusToFahrenheit(celsius) {
  return Math.round((celsius * 9) / 5 + 32);
}

/**
 * Convert Fahrenheit to Celsius
 * @param {number} fahrenheit - Temperature in Fahrenheit
 * @returns {number} Temperature in Celsius (rounded to nearest integer)
 */
export function fahrenheitToCelsius(fahrenheit) {
  return Math.round(((fahrenheit - 32) * 5) / 9);
}

/**
 * Format temperature display with appropriate unit
 * @param {number} tempCelsius - Temperature in Celsius (from backend)
 * @param {boolean} useFahrenheit - Whether to display in Fahrenheit
 * @param {number} precision - Number of decimal places (default: 0)
 * @returns {string} Formatted temperature with unit
 */
export function formatTemperature(tempCelsius, useFahrenheit = false, precision = 0) {
  if (tempCelsius === null || tempCelsius === undefined) {
    return useFahrenheit ? '0°F' : '0°C';
  }
  
  // Special case: 0 means "default" regardless of temperature unit
  if (tempCelsius === 0) {
    const unit = useFahrenheit ? '°F' : '°C';
    return `0${unit}`;
  }
  
  const temp = useFahrenheit ? celsiusToFahrenheit(tempCelsius) : Math.round(tempCelsius);
  const unit = useFahrenheit ? '°F' : '°C';
  
  return `${temp.toFixed(precision)}${unit}`;
}

/**
 * Format temperature value only (no unit)
 * @param {number} tempCelsius - Temperature in Celsius (from backend)
 * @param {boolean} useFahrenheit - Whether to display in Fahrenheit
 * @param {number} precision - Number of decimal places (default: 0)
 * @returns {number} Temperature value
 */
export function formatTemperatureValue(tempCelsius, useFahrenheit = false, precision = 0) {
  if (tempCelsius === null || tempCelsius === undefined) {
    return 0;
  }
  
  // Special case: 0 means "default" regardless of temperature unit
  if (tempCelsius === 0) {
    return 0;
  }
  
  const temp = useFahrenheit ? celsiusToFahrenheit(tempCelsius) : Math.round(tempCelsius);
  return Number(temp.toFixed(precision));
}

/**
 * Get temperature unit symbol
 * @param {boolean} useFahrenheit - Whether to use Fahrenheit
 * @returns {string} Unit symbol
 */
export function getTemperatureUnit(useFahrenheit = false) {
  return useFahrenheit ? '°F' : '°C';
}

/**
 * Convert input temperature to Celsius for backend
 * @param {number} inputTemp - Temperature from user input
 * @param {boolean} inputInFahrenheit - Whether the input is in Fahrenheit
 * @returns {number} Temperature in Celsius
 */
export function convertInputToCelsius(inputTemp, inputInFahrenheit = false) {
  if (inputTemp === null || inputTemp === undefined || inputTemp === '') {
    return 0;
  }
  
  const numTemp = Number(inputTemp);
  
  // Special case: 0 means "default" regardless of temperature unit
  if (numTemp === 0) {
    return 0;
  }
  
  return inputInFahrenheit ? fahrenheitToCelsius(numTemp) : numTemp;
}

/**
 * Convert Celsius from backend to display units for input fields
 * @param {number} tempCelsius - Temperature in Celsius (from backend)
 * @param {boolean} displayInFahrenheit - Whether to display in Fahrenheit
 * @returns {number} Temperature in display units
 */
export function convertCelsiusToDisplay(tempCelsius, displayInFahrenheit = false) {
  if (tempCelsius === null || tempCelsius === undefined) {
    return 0;
  }
  
  // Special case: 0 means "default" regardless of temperature unit
  if (tempCelsius === 0) {
    return 0;
  }
  
  return displayInFahrenheit ? celsiusToFahrenheit(tempCelsius) : Math.round(tempCelsius);
}
