#include "Autotune.h"
#include <Arduino.h>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <numeric>

Autotune::Autotune() {};

void Autotune::reset() {
    values.clear();
    times.clear();
    slopes.clear();
    slopeTimes.clear();
    currentConfirmations = 0;
    reactionDetected = false;
    maxSlopeFound = false;
    finished = false;
    initialSlope = 0.0f;
    maxPowerOn = false;
}

void Autotune::update(float temperature, float currentTime) {
    // Check if the autotune process is finished
    if (finished)
        return;

    values.push_back(temperature); // Store the temperature value
    times.push_back(currentTime);  // Store the associated time stamp

    if (values.size() > N) { // Check if we have enough data points to analyze
        std::deque<float> local_times(times.end() - N, times.end());
        std::deque<float> local_values(values.end() - N, values.end());
        float slope = computeSlope(local_times, local_values);

        if (!reactionDetected) {
            if (slope > initialSlope + epsilon) {
                currentConfirmations++;
                if (currentConfirmations >= requiredConfirmations) {
                    reactionDetected = true;
                    reactionTime = times[times.size() - requiredConfirmations];
                }
            } else {
                // Waiting for the reaction to be detected
                currentConfirmations = 0;
                if (currentTime - startPowerOnTime > maxTimeOut_s)
                    finished = true;
            }
        } else {
            slopes.push_back(slope);
            slopeTimes.push_back(currentTime);

            if (slopes.size() >= N) {
                float slopeOfSlope = computeSlope(slopeTimes, slopes);
                if (slopeOfSlope < 0 && !maxSlopeFound && temperature >values[0] + 7) {
                    auto maxIt = std::max_element(slopes.begin(), slopes.end());
                    system_gain = *maxIt;
                    maxSlopeTime = slopeTimes[std::distance(slopes.begin(), maxIt)];

                    maxSlopeFound = true;
                    finished = true;

                    system_pure_delay = reactionTime - startPowerOnTime;
                    computeControllerGains(system_pure_delay, system_gain);
                }
                slopes.pop_front();
                slopeTimes.pop_front();
            }
        }
        values.pop_front();
        times.pop_front();
    } else {
        // Not enough data points yet, wait for more, but if we have enough data points
        // to compute the slope, we can compute it and store it
        if (values.size() == N) {
            std::deque<float> local_times(times.end() - N, times.end());
            std::deque<float> local_values(values.end() - N, values.end());
            initialSlope = computeSlope(local_times, local_values);
            maxPowerOn = true; // Now we can start to heat up the system
            startPowerOnTime = currentTime;
        }
    }
}

void Autotune::computeControllerGains(float delay, float gain) {
    // Compute the controller gains based on the system delay and gain
    // This is a simple implementation of the Ziegler-Nichols method for PID tuning
    // The gains are computed based on the assumption of a first-order system with time delay
    // The method assumes that the controller output is between -1 and 1 where 1 is equal to maximum power
    float maxMargin = 70.0f;
    float minMargin = 20.0f;

    float range = maxMargin-minMargin;

    const float min_phase_margin = minMargin+ tuningPercentage/100*range;
    const float integ_delay = 10.0f;

    float mphi = min_phase_margin + integ_delay;
    cross_freq = (180.0f - mphi - 90.0f) / (delay * 360.0f);

    float kp = (2.0f * M_PI * cross_freq) / gain;
    float tanphi = std::tan((90.0f - integ_delay) * M_PI / 180.0f);
    float fi = cross_freq / tanphi;
    float ki = fi * 2.0f * M_PI * kp;

    float ku = kp / 0.7f;
    float tu = 1.75f * ku / ki;
    float kd = 0.105f * ku * tu * 0.35f; // Reduced to only 35% of Kd because of gain margin migh by too close to unstability, test showed it's unecessary to have derivative
    float kff = 1 / gain;             // Can go full gain inverse because we only estimate the speed and miss the static gain so we're always lower than the actual real system gain 

    Kp = kp;
    Ki = ki;
    Kd = kd;
    Kff = kff;
}

float Autotune::computeSlope(const std::deque<float> &x, const std::deque<float> &y) {
    // Calculate the slope of the line using the least squares method
    // Goal is to find the slope of the line that best fits the data points cloud
    // rather thand performing a pure derivative and filtering it
    // This is a more robust method to find the derivative of a noisy heavily quantified signal
    int n = x.size();
    if (n < 2)
        return 0.0f;

    float sum_x = std::accumulate(x.begin(), x.end(), 0.0f);
    float sum_y = std::accumulate(y.begin(), y.end(), 0.0f);
    float sum_xx = 0.0f, sum_xy = 0.0f;

    for (int i = 0; i < n; ++i) {
        sum_xx += x[i] * x[i];
        sum_xy += x[i] * y[i];
    }

    float denom = n * sum_xx - sum_x * sum_x;
    if (denom == 0.0f)
        return 0.0f;

    return (n * sum_xy - sum_x * sum_y) / denom;
}

void Autotune::setupAutotune(unsigned int windowSize, float slopeThreshold, unsigned int confirmationCount) {
    N = windowSize;
    epsilon = slopeThreshold;
    requiredConfirmations = confirmationCount;
}

void Autotune::setWindowsize(unsigned int size) { N = size; }

void Autotune::setEpsilon(float eps) { epsilon = eps; }

void Autotune::setRequiredConfirmations(unsigned int confirmations) { requiredConfirmations = confirmations; }

void Autotune::setTimeOut(float timeOut) { maxTimeOut_s = timeOut; }

bool Autotune::isFinished() const { return finished; }
float Autotune::getKp() const { return Kp; }
float Autotune::getKi() const { return Ki; }
float Autotune::getKd() const { return Kd; }
float Autotune::getKff() const { return Kff; }


void Autotune::setTuningGoal(float percentage)
{
    /**
     * @brief Configure the PID tuning aggressiveness as a percentage.
     *
     * This function allows the user to specify how aggressive or conservative the PID controller
     * should be tuned by providing a value between 0 and 100. A lower percentage corresponds to
     * a larger phase margin, offering more robustness and a more stable—but slower—response.
     * A higher percentage reduces the phase margin for improved speed and performance at the
     * expense of reduced stability margin. Internally, values outside the [0, 100] range are clamped
     * to ensure a valid tuning setting.
     * 
     * @param percentage Desired tuning aggressiveness (0 = fully conservative, 100 = maximum speed).
     */
    if (percentage > 100.0f) {
        tuningPercentage = 100;
    }else if (percentage < 0.0f) {
        tuningPercentage = 0;
    }else {
        tuningPercentage = 100-(int)std::round(percentage);
    }
}