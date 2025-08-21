#ifndef HYDRAULICPARAMETERESTIMATOR_H
#define HYDRAULICPARAMETERESTIMATOR_H

#include <deque>
#include <math.h>

class HydraulicParameterEstimator {
  public:
    HydraulicParameterEstimator(float dt_ = 0.03f);

    bool update(float Q_in, float P_raw);
    bool updateFilteredPressure(float P_raw);
    void reset();
    bool hasConverged();
    float getResistance() { return K_est; };
    float getCovariance() { return P_cov[1][1]; };

    float C_fixed;
    float K_est_init;
    float K_est;

    // Valeurs filtrées
    float P_filtered;
    float dPdt_filtered;
    float R_filtered;
    float dRdt_filtered;

    // === Etat & hyperparamètres EKF ===
    float X_state[2] = {0.0f, 0.0f}; // [P, k]
    float P_cov[2][2] = {0};
    float Qk[2][2] = { // Model noise [Qin,Wk]
        {0.0, 0.0f},
        {0.0f, 1e-18f}};
    float meas_noise_var = 1e-4f; // Bruit mesure P
    float lambda = 0.8f;          // Forget factor

  private:
    float dt;
    float epsilon = 1e-12f;
    int counter;

    bool isValid(float x) { return fabs(x) < 1e30f; }
};

#endif
