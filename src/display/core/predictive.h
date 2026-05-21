#ifndef PREDICTIVE_H
#define PREDICTIVE_H

#include <Arduino.h>
#include <deque>

class VolumetricRateCalculator {
  public:
    explicit VolumetricRateCalculator(double window_duration) : windowDuration(window_duration) {}

    void addMeasurement(double volume) {
        const unsigned long now = millis();
        measurements.emplace_back(volume);
        measurementTimes.emplace_back(now);

        // Unsigned subtraction is wrap-safe across the ~49d millis() rollover.
        while (!measurementTimes.empty() && static_cast<double>(now - measurementTimes.front()) >= windowDuration) {
            measurements.pop_front();
            measurementTimes.pop_front();
        }
    }

    double getRate(unsigned long time = 0) const {
        if (time == 0) {
            time = millis();
        }
        // perform a linear fit through the last PREDICTIVE_TIME (ms) of data time & measurement data and return the slope
        if (measurements.size() < 2)
            return 0.0;

        size_t i = measurementTimes.size();
        // Walk backward over in-window entries; stop at the first out-of-window one.
        while (i > 0 && static_cast<double>(time - measurementTimes[i - 1]) < windowDuration) {
            i--;
        }
        // i is the index of the first entry after the cutoff

        if (measurements.size() - i < 2)
            return 0.0;

        double v_mean = 0.0;
        double t_mean = 0.0;
        for (size_t j = i; j < measurements.size(); j++) {
            v_mean += measurements[j];
            t_mean += measurementTimes[j];
        }
        v_mean = v_mean / (measurements.size() - i);
        t_mean = t_mean / (measurements.size() - i);

        double tdev2 = 0.0;
        double tdev_vdev = 0.0;
        for (size_t j = i; j < measurements.size(); j++) {
            tdev_vdev += (measurementTimes[j] - t_mean) * (measurements[j] - v_mean);
            tdev2 += pow(measurementTimes[j] - t_mean, 2.0);
        }

        if (tdev2 < 1e-10) {
            return 0.0;
        }

        double volumePerMilliSecond = tdev_vdev / tdev2;              // the slope (volume per millisecond) of the linear best fit
        return volumePerMilliSecond > 0 ? volumePerMilliSecond : 0.0; // return 0 if it is not positive, convert to seconds
    }

    double getOvershootAdjustMillis(double expectedVolume, double actualVolume) {
        if (measurementTimes.size() < 2) {
            return 0.0;
        }

        const double overshoot = actualVolume - expectedVolume;
        const double rate = getRate(measurementTimes.back());

        if (rate < 1e-10) {
            ESP_LOGW("VolumetricRateCalculator", "Invalid rate: %f", rate);
            return 0.0;
        }

        const double adjust = overshoot / rate;

        if (isnan(adjust) || isinf(adjust)) {
            ESP_LOGW("VolumetricRateCalculator", "Invalid adjust: %f", adjust);
            return 0.0;
        }

        return adjust;
    }

  private:
    std::deque<double> measurements;
    std::deque<unsigned long> measurementTimes;
    const double windowDuration;
};

#endif
