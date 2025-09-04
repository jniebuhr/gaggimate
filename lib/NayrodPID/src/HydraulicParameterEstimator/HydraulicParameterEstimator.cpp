#include "HydraulicParameterEstimator.h"
#include <cmath>
#ifdef ARDUINO
#include <Arduino.h>
#else
#include <ArduinoStub.h>
#endif

HydraulicParameterEstimator::HydraulicParameterEstimator(float dt_)
    : dt(dt_), C_fixed(0.9f), lambda(0.8f), K_est_init(0.0f), counter(0) {

    X_state[0] = 0.0f;       // P
    X_state[1] = K_est_init; // k
    X_state[2] = 0.0f;       // Qout

    // init covariance
    P_cov[0][0] = 1e6f;
    P_cov[0][1] = 0.0f;
    P_cov[0][2] = 0.0f;
    P_cov[1][0] = 0.0f;
    P_cov[1][1] = 1e6f;
    P_cov[1][2] = 0.0f;
    P_cov[2][0] = 0.0f;
    P_cov[2][1] = 0.0f;
    P_cov[2][2] = 1e6f;

    // process noise
    float sigmaQin = 0.7f;        // ml/s incertitude pompe
    float kDrift = 0.1f;          // ml/s/√bar/s (puck change lent)
    float qOutDrift = 0.3f;       // ml/s²
    float pressureNoise = 0.002f; // bar RMS bruit capteur

    setPhysicalNoises(sigmaQin, kDrift, qOutDrift, pressureNoise);

    C_eff = C_fixed;
}

void HydraulicParameterEstimator::setPhysicalNoises(float sigmaQin, float kDrift, float qOutDrift, float pressureNoise) {
    // bruit sur conservation volume (propagation incertitude Qin -> P)
    Qk[0][0] = powf(dt / C_fixed * sigmaQin, 2.0f);
    // marche aléatoire de k (variation max attendue)
    Qk[1][1] = powf(kDrift * dt, 2.0f);
    // variation rapide de Qout
    Qk[2][2] = powf(qOutDrift * dt, 2.0f);
    // bruit de mesure capteur
    meas_noise_var = powf(pressureNoise, 2.0f);
}

void HydraulicParameterEstimator::reset() {
    counter = 0;
    X_state[0] = 1e-4f;      // P
    X_state[1] = K_est_init; // k
    X_state[2] = 0.0f;       // Qout

    P_cov[0][0] = 0.01f;
    P_cov[0][1] = 0.0f;
    P_cov[0][2] = 0.0f;
    P_cov[1][0] = 0.0f;
    P_cov[1][1] = 1e6f;
    P_cov[1][2] = 0.0f;
    P_cov[2][0] = 0.0f;
    P_cov[2][1] = 0.0f;
    P_cov[2][2] = 1.0f;

    Vin_cum = 0.0f;
}

bool HydraulicParameterEstimator::hasConverged() { return P_cov[1][1] < 1e-16f; }
float HydraulicParameterEstimator::getEffectiveCompliance(float Vin) {
    // Paramètres à tuner
    const float Vfill = 3.5f;     // mL volume variation C
    const float Vmin = 8.0f;      // mL volume remplissage
    const float C_init = 8.0f;    // ml/bar, moins extrême
    const float C_puck = C_fixed; // compliance normale

    float C_eff = C_puck + (C_init - C_puck) * exp((-Vin + Vmin) / Vfill);

    if (Vin < Vmin) {
        C_eff = C_init;
    }
    return C_eff;
}

bool HydraulicParameterEstimator::update(float Q_in, float P_meas) {
    counter++;

    Vin_cum += Q_in * dt;
    // if(P_meas<0.8)
    //     return false;
    C_eff = getEffectiveCompliance(Vin_cum);
    float Pk = X_state[0];
    float kk = X_state[1];
    float Qoutk = X_state[2];

    float sqrtP = (Pk > epsilon) ? sqrtf(Pk) : sqrtf(epsilon);

    // === Prediction ===
    float P_pred = Pk + dt * ((Q_in - Qoutk) / C_eff);
    float k_pred = kk;
    float Qout_pred = kk * sqrtP;

    float X_pred[3] = {P_pred, k_pred, Qout_pred};

    // Jacobian F
    float dPdP = 1.0f;
    float dPdQout = -dt / C_eff;
    float dQoutdP = (kk > 0.0f) ? (0.5f * kk / sqrtP) : 0.0f;
    float dQoutdk = sqrtP;

    float F[3][3] = {{dPdP, 0.0f, dPdQout}, {0.0f, 1.0f, 0.0f}, {dQoutdP, dQoutdk, 0.0f}};

    // covariance prédite
    float P_pred_cov[3][3] = {0};
    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 3; ++j) {
            for (int k = 0; k < 3; ++k)
                for (int l = 0; l < 3; ++l)
                    P_pred_cov[i][j] += F[i][k] * P_cov[k][l] * F[j][l];
            P_pred_cov[i][j] += Qk[i][j];
        }

    // === Correction ===
    float H[3] = {1.0f, 0.0f, 0.0f}; // mesure: P
    float S = 0.0f;
    for (int i = 0; i < 3; ++i)
        S += H[i] * P_pred_cov[i][0];
    S += meas_noise_var;

    float K_gain[3];
    for (int i = 0; i < 3; ++i)
        K_gain[i] = P_pred_cov[i][0] / S;

    float innov = P_meas - X_pred[0];

    for (int i = 0; i < 3; ++i)
        X_state[i] = X_pred[i] + K_gain[i] * innov;

    // Joseph form
    float I_KH[3][3];
    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 3; ++j)
            I_KH[i][j] = (i == j ? 1.0f : 0.0f) - K_gain[i] * H[j];

    float temp[3][3] = {0};
    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 3; ++j)
            for (int k = 0; k < 3; ++k)
                temp[i][j] += I_KH[i][k] * P_pred_cov[k][j];

    for (int i = 0; i < 3; ++i)
        for (int j = 0; j < 3; ++j)
            P_cov[i][j] = temp[i][j];

    K_est = fmaxf(X_state[1], 0.0f);

    return true;
}
