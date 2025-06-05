#include "SimplePID.h"
#include <Arduino.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <numeric>

SimplePID::SimplePID(float *controlerOutputPtr, float *sensorOutputPtr, float *setpointTargetPtr) {
    this->controlerOutput = controlerOutputPtr;
    this->sensorOutput = sensorOutputPtr;
    this->setpointTarget = setpointTargetPtr;
}

bool SimplePID::update() {
    if (mode == Control::manual) {
        return false;
    }
    uint32_t now = millis();
    uint32_t timeChange = (now - lastTime);
    if (timeChange < ctrl_freq_sampling * 1000) {
        return false;
    }
    lastTime = now;

    if (!isInitialized) {
        initSetPointFilter(*this->sensorOutput);
        resetFeedbackController();
        if (gainFF != 0.0f)
            isFeedForwardActive = true; // Activate the feedforward control if gainFF is not zero
        isInitialized = true;
    }

    // Compute the filtered setpoint values
    float FFOut = 0.0f;
    if (isfilterSetpointActive) {
        setpointFiltering(setpointFilterFreq);
    } else {
        setpointFiltered = *setpointTarget;
    } // If the filter is not active, use the setpoint directly

    if (isFeedForwardActive)
        FFOut = setpointDerivative * gainFF;
    Serial.printf("%.2f\t %.2f\t %.2f\t %.2f\n", *setpointTarget, setpointFiltered, setpointDerivative, *sensorOutput);

    float deltaTime = 1.0f / ctrl_freq_sampling; // Time step in seconds

    // Feeback terms
    float error = setpointFiltered - *sensorOutput;

    float Pout = gainKp * error;

    feedback_integralState += error * deltaTime;
    float Iout = gainKi * feedback_integralState;

    float derivative = (error - prevError) / deltaTime;
    float Dout = gainKd * derivative;

    // Calculate the output before antiwindup clamping
    float sumPID = Pout + Iout + Dout + FFOut;
    float sumPIDsat = constrain(sumPID, ctrlOutputLimits[0], ctrlOutputLimits[1]);

    // Antiwindup clamping
    bool isSaturated = (sumPID < ctrlOutputLimits[0] || sumPID > ctrlOutputLimits[1]); // Check if the output is saturated
    bool isSameSign =
        ((error > 0 && sumPID > 0) || (error < 0 && sumPID < 0)); // Check if the error and output have the same sign
    // Serial.printf("OutputPID: %.2f, Integ out: %.2f\n", sumPIDsat, Iout);
    if (isSaturated && isSameSign) {
        // Serial.printf("Antiwindup clamping: %.2f\n", feedback_integralState);
        feedback_integralState -=
            error * deltaTime; // Forbide the integration to happen when the output is saturated and the error is in the same
                               // direction as the output (i.e. the system is not able to follow the setpoint)
        Iout = gainKi * feedback_integralState; // Recompute the integral term with the new state
        sumPID = Pout + Iout + Dout + FFOut;    // Recompute the output with the new integral state
        sumPIDsat = constrain(sumPID, ctrlOutputLimits[0], ctrlOutputLimits[1]);
    }

    // Serial.printf("Pout: %.2f, Iout: %.2f, Dout: %.2f, FFOut: %.2f, OutputPID: %.2f, SumPID: %.2f\n", Pout, Iout, Dout, FFOut,
    // sumPIDsat, sumPID); Update previous values for next iteration
    prevError = error;
    prevOutput = sumPIDsat;

    *controlerOutput = sumPIDsat;

    return true;
}

void SimplePID::setpointFiltering(float freq) {

    float wn = (2.0f * PI * freq);
    float dderiv = wn * wn * (*setpointTarget - setpointFilteredValues.back());   
    setpointFiltstate1 += dderiv / ctrl_freq_sampling;
    setpointDerivative = setpointFiltstate1 - wn * 2 * setpointFiltXi * setpointFilteredValues.back();
    // Output the filtered setpoint values
    setpointDerivative = constrain(setpointDerivative, setpointRatelimits[0], setpointRatelimits[1]);
    // Integrate (forward euler) the setpoint derivative to get the filtered setpoint value
    float integ = setpointFilteredValues.back() + setpointDerivative / ctrl_freq_sampling;
    // Add the new setpoint to the history to introduce a delay between the setpoint derivative and the filtered setpoint
    setpointFilteredValues.push_back(integ);
    if (setpointFilteredValues.size() > setpointDelaySamples + 1) {
        setpointFilteredValues.pop_front();
    }
    setpointFiltered = setpointFilteredValues.front(); // Get the filtered setpoint value

}

void SimplePID::initSetPointFilter(float initialValue) {
    setpointFilteredValues.clear();
    for (int i = 0; i < setpointDelaySamples + 1; ++i) {
        setpointFilteredValues.push_back(initialValue);
    }
    setpointFiltstate1 = 2*setpointFiltXi*2*PI*setpointFilterFreq*initialValue;
}

void SimplePID::resetFeedbackController() {
    feedback_integralState = 0.0f; // Reset the integral state
    prevError = 0.0f;              // Reset the previous error for derivative calculation
    prevOutput = 0.0f;             // Reset the previous output for derivative calculation
}

void SimplePID::reset() {
    resetFeedbackController();
    isInitialized = false;
    setpointFilteredValues.clear();
    setpointFiltstate1 = 0.0f;
}

// GETTER-SETTER FUNCTIONS
// Setpoint
void SimplePID::setSetpointRateLimits(float minRate, float maxRate) {
    setpointRatelimits[0] = minRate;
    setpointRatelimits[1] = maxRate;
}

void SimplePID::setSetpointDelaySamples(int delaySamples) { setpointDelaySamples = delaySamples; }
void SimplePID::activateSetPointFilter(bool flag) { isfilterSetpointActive = flag; }
void SimplePID::setSetpointFilterFrequency(float freq) { setpointFilterFreq = freq; }

// Feedback controller
void SimplePID::setControllerPIDGains(float Kp, float Ki, float Kd, float FF) {
    this->gainKp = Kp;
    this->gainKi = Ki;
    this->gainFF = FF;
    this->gainKd = Kd;
}

void SimplePID::setSamplingFrequency(float freq) { ctrl_freq_sampling = freq; }
void SimplePID::setCtrlOutputLimits(float minOutput, float maxOutput) {
    ctrlOutputLimits[0] = minOutput;
    ctrlOutputLimits[1] = maxOutput;
}

void SimplePID::setMode(Control modeCMD) {
    if (modeCMD == Control::automatic && this->mode == Control::manual) {
        isInitialized = false; // Reset the controller when switching to automatic mode
    }
    this->mode = modeCMD;
}

void SimplePID::setManualOutput(float output) {
    if (this->mode == Control::automatic)
        setMode(Control::manual);
    manualOutput = output;
}

void SimplePID::computeSetpointDelay(float systemDelay) {
    // systemDelay : (s) system pure delay
    float setpointFilterDelay = 1 / (2 * PI * setpointFilterFreq); // Setpoint filter delay in seconds
    float totalDelay =
        systemDelay -
        setpointFilterDelay; // Delay to apply to synchronise the setpoint with the stepoint derivative for the feedforward term
    if (totalDelay < 0.0f) {
        totalDelay = 0.0f; // Set the delay to 0 if it is negative
    }
    setpointDelaySamples = static_cast<uint32_t>(totalDelay * ctrl_freq_sampling); // Convert to number of samples
}

void SimplePID::activateFeedForward(bool flag) {
    if (gainFF == 0.0f) {
        // ERROR : feedforward gain is not activated
        isFeedForwardActive = false;
        // throw std::invalid_argument("Feedforward gain is 0.0, must be set to a non zero value.");
    } else {
        isFeedForwardActive = flag;
    }
}
