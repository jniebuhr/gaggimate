#ifndef HYDRAULICPARAMETERESTIMATOR_H
#define HYDRAULICPARAMETERESTIMATOR_H

#include <deque>
#include <math.h>

class HydraulicParameterEstimator {
  public:
    HydraulicParameterEstimator(float dt_ = 0.03f);

    bool update(float Q_in, float P_raw);
    void reset();
    bool hasConverged();
    void setPhysicalNoises(float sigmaQin, float kDrift, float qOutDrift, float pressureNoise);
    float getEffectiveCompliance(float Vin);
    float getResistance() { return X_state[1]; }; // k
    float getQout() { return X_state[2]; };       // Qout
    float getPressure() { return X_state[0]; };   // P

    float getCovarianceK() { return P_cov[1][1]; };
    float getCovarianceQout() { return P_cov[2][2]; };
    float getCeff() { return C_eff; };
    float C_fixed;
    float K_est_init;
    float K_est;
    float C_eff;

    float P_filtered;
    float dPdt_filtered;

    // === Etat & hyperparamètres EKF ===
    float X_state[3] = {0.0f, 0.0f, 0.0f}; // [P, k, Qout]
    float P_cov[3][3] = {0};
    float Qk[3][3] = {0}; // process noise
    float meas_noise_var; // noise on P
    float lambda;         // forget factor

  private:
    float dt;
    float epsilon = 1e-6f;
    int counter;
    bool isValid(float x) { return fabs(x) < 1e30f; }
    float Vin_cum = 0.0f;
};

#endif
