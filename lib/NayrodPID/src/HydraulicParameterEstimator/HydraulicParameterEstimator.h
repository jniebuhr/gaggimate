#ifndef HYDRAULICPARAMETERESTIMATOR_H
#define HYDRAULICPARAMETERESTIMATOR_H

#include <deque>
#include <math.h>
class HydraulicParameterEstimator {
public:
    HydraulicParameterEstimator(float dt_ = 0.03f);

    bool update(float Q_in, float P_raw);
    bool updateFilteredPressure(float P_raw);
    bool updateFilteredResistance(float R_input);
    void reset();
    bool hasConverged();
    void setLambda(float l);
    void setResistanceBounds(float Rmin, float Rmax);
    float getResistanceMinBound();
    float getResistance(){return R_est;};
    float getCovariance(){return P_cov;};

    float C_fixed;

    // Résultat estimé
    float K_est;
    float R_est;

    // Valeurs filtrées
    float P_filtered;
    float dPdt_filtered;
    float R_filtered;
    float dRdt_filtered;

private:
    bool isValid(float x) {
        return (x == x) && (x - x == 0) && fabs(x) < 1e30f;
    }

    float dt;
    float lambda;
    float epsilon = 1e-12f;
    float meas_noise_var = 1e-4f;

    float theta;           // <<< MODIF : scalaire
    float P_cov;           // <<< MODIF : scalaire

    float R_min, R_max;

    int counter;
};

#endif
