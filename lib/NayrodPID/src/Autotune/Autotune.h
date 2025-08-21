#pragma once

#include <deque>
#include <functional>

class Autotune {
  public:
    Autotune();

    void reset();
    void update(float temperature, float currentTime);

    bool isFinished() const;

    float getKp() const;
    float getKi() const;
    float getKd() const;
    float getKff() const;
    void setupAutotune(unsigned int windowSize, float slopeThreshold, unsigned int confirmationCount);
    void setWindowsize(unsigned int size);
    void setEpsilon(float eps);
    void setRequiredConfirmations(unsigned int confirmations);
    void setTimeOut(float timeOut);
    void setTuningGoal(float percentage);
    bool maxPowerOn = false; // Flag to indicate if system should be turned on with maximum power

    float getSystemDelay() const { return system_pure_delay; }
    float getSystemGain() const { return system_gain; };
    float getCrossoverFreq() const { return cross_freq; };

  private:
    float computeSlope(const std::deque<float> &x, const std::deque<float> &y);
    void computeControllerGains(float system_pure_delay, float system_gain);

    unsigned int N = 4;   // Size of the moving window to compute the derivative of temperature
    float epsilon = 0.4f; // Temperature variation threshold to detect the reaction
    unsigned int requiredConfirmations =
        3; // Number consecutive detection of rising temperature to consider the reaction detected
    float tuningPercentage = 50;
    std::deque<float> values, times, slopes, slopeTimes;
    float initialTemp; // Autotune starting point temperature

    unsigned int currentConfirmations;
    bool reactionDetected, maxSlopeFound, finished;

    float reactionTime = -1.0f, maxSlope = -1.0f, maxSlopeTime = -1.0f, startPowerOnTime = -1.0f;
    float Kp, Ki, Kd, Kff;
    float initialSlope;
    float maxTimeOut_s = 20; // (s) Maximum time to wait for the reaction to be detected before giving up

    float system_pure_delay = 0.0f;
    float system_gain = 0.0f;
    float cross_freq = 0.0f;
};
