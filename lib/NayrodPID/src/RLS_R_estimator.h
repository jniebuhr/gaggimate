#pragma once

#include <cmath>
#include <limits>

/**
 * @brief Classe RLSFilter pour estimer en ligne la résistance R
 *        via l'algorithme RLS (Recursive Least Squares) scalaire amélioré.
 *
 * Modèle : P = Q * R + bruit
 * R est mis à jour à chaque appel de update() sans avoir besoin de dt.
 */
class RLSFilter {
  public:
    /**
     * @brief Constructeur
     * @param initial_R                Estimation initiale de R
     * @param initial_Pcov            Covariance initiale (confiance faible si grande)
     * @param Rmin                    Valeur minimale de R estimée
     * @param Rmax                    Valeur maximale de R estimée
     * @param measurement_noise_var   Variance du bruit de mesure
     * @param forgetting_factor       Facteur d'oubli (1.0 = pas d'oubli, <1.0 = adaptation)
     * @param numerical_epsilon       Epsilon pour la stabilité numérique
     */
    RLSFilter(float initial_R = 5e7f, float initial_Pcov = 1e15,
              float Rmin = 9e-6f, // Q0/P = 10^-6/9 ( (m3/s)/bar )
              float Rmax = INFINITY, float measurement_noise_var = 3e-4f, float forgetting_factor = 0.85f,
              float numerical_epsilon = 1e-12f, float dt = 0.03f)
        : R_est(initial_R), R_est_init(initial_R), P_cov(initial_Pcov), P_cov_init(initial_Pcov), R_min(Rmin), R_max(Rmax),
          meas_noise_var(measurement_noise_var), lambda(forgetting_factor), epsilon(numerical_epsilon), _dt(dt), R_est_prev(0) {}

    /**
     * @brief Met à jour l'estimation de R en fonction des nouvelles mesures
     * @param Q       Débit mesuré (m3/s)
     * @param P_meas  Pression mesurée (Pa)
     * @return true si la mise à jour a réussi, false si les entrées sont invalides
     */
    bool update(float Q, float P_meas) {
        // Validation des entrées
        if (!isValid(Q) || !isValid(P_meas) || P_meas < 0.4f) {
            return false;
        }
        counter++; // Augmenter le compteur de mesure pour garder une trace du nombre d'échantillon ayant servi a la convergeance
        // Sauvegarde des valeurs avant mise à jour (pour rollback si nécessaire)
        R_est_prev = R_est;
        float P_cov_prev = P_cov;

        // Application du facteur d'oubli
        P_cov /= lambda;

        // 1) Calcul adaptatif du gain avec stabilité numérique améliorée
        float denominator = 1.0f + Q * P_cov * Q + epsilon;
        float K = (P_cov * Q) / denominator;

        // 2) Mise à jour de l'estimation de R
        float error = P_meas - Q * R_est;
        R_est += K * error;

        // 3) Mise à jour de la covariance avec la forme de Joseph (plus stable)
        float temp = 1.0f - K * Q;
        P_cov = temp * P_cov * temp + K * K * meas_noise_var;

        // Vérification de la validité de la covariance
        if (!isValid(P_cov) || P_cov <= 0.0f) {
            // Rollback en cas de problème numérique
            R_est = R_est_prev;
            P_cov = P_cov_prev;
            return false;
        }

        // 4) Contraintes sur l'estimation de R
        bool was_clamped = false;
        if (R_est < R_min) {
            R_est = R_min;
            was_clamped = true;
        } else if (R_est > R_max) {
            R_est = R_max;
            was_clamped = true;
        }
        return true;
    }

    /**
     * @brief Récupère la valeur estimée actuelle de R
     * @return estimation de la résistance R
     */
    float getEstimate() const { return R_est; }

    /**
     * @brief Récupère la covariance actuelle
     * @return covariance de l'estimation
     */
    float getCovariance() const { return P_cov; }

    /**
     * @brief Récupère le niveau de confiance (inverse de la covariance)
     * @return niveau de confiance (plus élevé = plus confiant)
     */
    float getConfidence() const { return 1.0f / (P_cov + epsilon); }

    /**
     * @brief Réinitialise le filtre avec les valeurs initiales
     */
    void reset() {
        R_est = R_est_init;
        P_cov = P_cov_init;
        counter = 0;
    }

    /**
     * @brief Vérifie si le filtre est dans un état stable
     * @return true si le filtre est dans un état valide
     */
    bool isHealthy() const { return isValid(R_est) && isValid(P_cov) && P_cov > 0.0f; }

    float getConvergenceScore() {

        bool delayPassed = ((float)counter * _dt) > 0.5f;
        float div = 20; // Critère de division de P_cov_init témoignant de la convergeance
        float C1 = log10f(R_est / sqrtf(P_cov)) / log10f(div);
        if (C1 < 0.0f)
            C1 = 0.0f;
        if (C1 > 1.0f)
            C1 = 1.0f;
        C1 *= delayPassed;
        // ESP_LOGI("","P_cov:%1.2e\tC1:%1.3f",P_cov,C1);
        return C1;
    }

  private:
    float R_est; ///< Estimation courante de R
    float R_est_prev;
    float P_cov;                ///< Covariance de l'estimation
    const float R_min, R_max;   ///< Bornes pour les contraintes
    const float meas_noise_var; ///< Variance du bruit de mesure
    const float lambda;         ///< Facteur d'oubli
    const float epsilon;        ///< Epsilon pour la stabilité numérique
    const float P_cov_init;
    const float R_est_init;
    int counter = 0;
    float _dt = 1.0f;

    /**
     * @brief Vérifie si une valeur est valide (pas NaN, pas infinie)
     * @param value Valeur à vérifier
     * @return true si la valeur est valide
     */
    bool isValid(float value) const { return std::isfinite(value) && !std::isnan(value); }
};
