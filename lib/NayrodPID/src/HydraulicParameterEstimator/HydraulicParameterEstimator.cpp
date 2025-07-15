#include "HydraulicParameterEstimator.h"
#include <cmath>
#ifdef ARDUINO
#include <Arduino.h>
#else
#include <ArduinoStub.h>
#endif

HydraulicParameterEstimator::HydraulicParameterEstimator(float dt_)
    : dt(dt_), C_fixed(1e-6f), lambda(0.8f), K_est_init(1e-4f), counter(0) {
    X_state[0] = 0.0f;       // P
    X_state[1] = K_est_init; // k
}

void HydraulicParameterEstimator::reset() {
    counter = 0;
    K_est = K_est_init;
    X_state[0] = 1e-4f; // P
    X_state[1] = K_est; // k

    P_cov[0][0] = 0.01f;
    P_cov[0][1] = 0.0f;
    P_cov[1][1] = 1e6f;
    P_cov[1][0] = 0.0f;
}

bool HydraulicParameterEstimator::hasConverged() {
    return P_cov[1][1] < 1e-16f;
    // return true;
}

bool HydraulicParameterEstimator::updateFilteredPressure(float P_raw) {
    static std::deque<float> buffer;

    constexpr int N = 5;
    constexpr float smooth_coeffs[N] = {-3, 12, 17, 12, -3};
    constexpr float deriv_coeffs[N] = {-2, -1, 0, 1, 2};

    buffer.push_back(P_raw);
    if (buffer.size() < N)
        return false;
    if (buffer.size() > N)
        buffer.pop_front();

    float smooth = 0.0f, deriv = 0.0f;
    for (int i = 0; i < N; ++i) {
        smooth += smooth_coeffs[i] * buffer[i];
        deriv += deriv_coeffs[i] * buffer[i];
    }

    P_filtered = smooth / 35.0f;
    dPdt_filtered = deriv / (10.0f * dt);
    return true;
}

bool HydraulicParameterEstimator::update(float Q_in, float P_raw) {
    counter++;
    // if (!updateFilteredPressure(P_raw)) return false;

    P_filtered = P_raw;
    float P_meas = P_filtered;
    if (P_meas < 0.3f)
        return false;

    float P_k = X_state[0];
    float k_k = X_state[1];

    // Modèle dynamique
    float sqrtP = (P_k > 0.001f) ? sqrtf(P_k) : 0.001f;
    float f1 = (1.0f / C_fixed) * Q_in - (k_k / C_fixed) * sqrtP;
    float P_pred = P_k + dt * f1;
    float k_pred = k_k;

    // Jacobienne F
    sqrtP = (P_k > 0.001) ? sqrtf(P_k) : 0.001f;
    float dfdP = -0.5f * k_k / (C_fixed * sqrtP);
    float dfdk = -sqrtP / C_fixed;
    float F[2][2] = {{1.0f + dt * dfdP, dt * dfdk}, {0.0f, 1.0f}};

    // Mise à jour covariance prédite
    float P_pred_cov[2][2] = {0};
    for (int i = 0; i < 2; ++i)
        for (int j = 0; j < 2; ++j) {
            P_pred_cov[i][j] = 0.0f;
            for (int k = 0; k < 2; ++k)
                for (int l = 0; l < 2; ++l)
                    P_pred_cov[i][j] += F[i][k] * P_cov[k][l] * F[j][l];
            P_pred_cov[i][j] += Qk[i][j];
        }

    // Correction
    float S = P_pred_cov[0][0] + meas_noise_var;
    float K_gain[2] = {P_pred_cov[0][0] / S, P_pred_cov[1][0] / S};

    float y_residual = P_meas - P_pred;
    X_state[0] = P_pred + K_gain[0] * y_residual;
    X_state[1] = k_pred + K_gain[1] * y_residual;

    // Serial.printf("p^:%.2e\tk^%.2ef\tp_k:%.2e\tk_k%.2ef\tinov:%.2e\tS:%.2e\tP0:%.2e\tP1:%.2e\tK1%.2e\tK2%.2e\tPcovpred0:%.2e\tPcovpred1:%.2e\n",
    //     P_pred,
    //     k_pred,
    //     X_state[0],
    //     X_state[1],
    //     y_residual,
    //     S,
    //     P_cov[0][0],
    //     P_cov[1][1],
    //     K_gain[0],
    //     K_gain[1],
    //     P_pred_cov[0][0],
    //     P_pred_cov[1][1]
    // );

    for (int i = 0; i < 2; ++i)
        for (int j = 0; j < 2; ++j)
            P_cov[i][j] = P_pred_cov[i][j] - K_gain[i] * P_pred_cov[0][j];

    K_est = std::max(X_state[1], 0.0f);
    // Serial.printf("%.2e\n",K_est);

    return true;
}
