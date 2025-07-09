#include "HydraulicParameterEstimator.h"
#include <cmath>
#include <Arduino.h>

HydraulicParameterEstimator::HydraulicParameterEstimator(float dt_)
    : dt(dt_), C_fixed(1e-8), lambda(0.8f),
      epsilon(1e-12f), meas_noise_var(1e-4f),
      R_est(1e8f), K_est(1e-8f), R_min(1.0f), R_max(1e9f), counter(0)
{
    theta = K_est;
    P_cov = 1e5f; 
}

void HydraulicParameterEstimator::setLambda(float l) {
    lambda = l;
}

void HydraulicParameterEstimator::setResistanceBounds(float Rmin, float Rmax) {
    R_min = Rmin;
    R_max = Rmax;
}

float HydraulicParameterEstimator::getResistanceMinBound() {
    return R_min;
}

void HydraulicParameterEstimator::reset() {
    counter = 0;
    K_est = 1e-8f;
    theta = K_est;
    P_cov = 1e5f;
}

bool HydraulicParameterEstimator::hasConverged() {
    return P_cov < 1e-21f;
}

// --------------------
// Filtrage pression SG
// --------------------
bool HydraulicParameterEstimator::updateFilteredPressure(float P_raw) {
    static std::deque<float> buffer;

    constexpr int N = 5;
    constexpr float smooth_coeffs[N] = { -3, 12, 17, 12, -3 };
    constexpr float deriv_coeffs[N]  = { -2, -1, 0, 1, 2 };

    buffer.push_back(P_raw);
    if (buffer.size() < N) return false;
    if (buffer.size() > N) buffer.pop_front();

    float smooth = 0.0f;
    float deriv = 0.0f;
    for (int i = 0; i < N; ++i) {
        smooth += smooth_coeffs[i] * buffer[i];
        deriv  += deriv_coeffs[i]  * buffer[i];
    }

    P_filtered = smooth / 35.0f;
    dPdt_filtered = deriv / (10.0f * dt);
    return true;
}

// ------------------------
// Filtrage R équivalent SG
// ------------------------
bool HydraulicParameterEstimator::updateFilteredResistance(float R_input) {
    static std::deque<float> R_buffer;

    constexpr int N = 5;
    constexpr float smooth_coeffs[N] = { -3, 12, 17, 12, -3 };
    constexpr float deriv_coeffs[N]  = { -2, -1, 0, 1, 2 };

    R_buffer.push_back(R_input);
    if (R_buffer.size() < N) return false;
    if (R_buffer.size() > N) R_buffer.pop_front();

    float R_smooth = 0.0f;
    float R_deriv = 0.0f;
    for (int i = 0; i < N; ++i) {
        R_smooth += smooth_coeffs[i] * R_buffer[i];
        R_deriv  += deriv_coeffs[i]  * R_buffer[i];
    }

    R_filtered = R_smooth / 35.0f;
    dRdt_filtered = R_deriv / (10.0f * dt);
    return true;
}

// --------------------------
// UPDATE : Kalman Filter pour k(t)
// --------------------------
bool HydraulicParameterEstimator::update(float Q_in, float P_raw) {
    if (!isValid(Q_in) || !isValid(P_raw)) return false;

    counter++;

    if (!updateFilteredPressure(P_raw)) return false;

    float P = P_filtered;
    float dPdt = dPdt_filtered;

    if (P < 0.3f) return false;

    // ---------
    // Modèle : dotP = (1/C) Q_in - (k/C) sqrt(P)
    // ---------

    float y_meas = dPdt;
    float H = -sqrtf(P) / C_fixed;   
    float u = (1.0f / C_fixed) * Q_in;

    // Résidu
    float y_residual = y_meas - u - H * theta;

    // Gain de Kalman
    float S = H * P_cov * H + meas_noise_var;
    float K_gain = P_cov * H / S;

    // Mise à jour de l'état
    theta = theta + K_gain * y_residual;

    // Mise à jour de la covariance
    P_cov = (1.0f - K_gain * H) * P_cov;

    // Un peu de forget factor pour maintenir l'adaptativité
    P_cov /= lambda;

    if (!isValid(P_cov)) {
        reset();
        return false;
    }

    // if (P_cov < 1e-5f) P_cov = 1e-5f;

    K_est = theta;

    if (K_est < 0.0f) K_est = 0.0f;

    if (K_est > 0.0f && P > 0.0f) {
        R_est = P / (K_est * sqrtf(P));
        R_est = K_est;
        updateFilteredResistance(R_est);
    }

    return true;
}
