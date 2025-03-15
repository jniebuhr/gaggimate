#ifndef PREDICTIVE_H
#define PREDICTIVE_H

#include <Arduino.h>

class VolumetricRateCalculator {
  public:
    explicit VolumetricRateCalculator(double window_duration) : windowDuration(window_duration) {}

    void addMeasurement(double volume) {
        measurements.emplace_back(volume);
        measurementTimes.emplace_back(millis());
    }

    double getRate(double time = 0) const {
        if (time == 0) {
            time = millis();
        }
        // perform a linear fit through the last PREDICTIVE_TIME (ms) of data time & measurement data and return the slope
        if (measurements.size() < 2)
            return 0.0;

        size_t i = measurementTimes.size();
        double cutoff = time - windowDuration;
        while (measurementTimes[i - 1] > cutoff) { // check from the most recent time
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
            tdev_vdev += (measurementTimes[i] - t_mean) * (measurements[i] - v_mean);
            tdev2 += pow(measurementTimes[i] - t_mean, 2.0);
        }
        double volumePerMilliSecond = tdev_vdev / tdev2;              // the slope (volume per millisecond) of the linear best fit
        return volumePerMilliSecond > 0 ? volumePerMilliSecond : 0.0; // return 0 if it is not positive, convert to seconds
    }

    double getOvershootAdjustMillis(double expectedVolume, double actualVolume) {
        if (measurementTimes.size() < 2)
            return 0.0;
        double overshoot = actualVolume - expectedVolume;
        return overshoot / getRate(measurementTimes.back());
    }

  private:
    std::vector<double> measurements;
    std::vector<double> measurementTimes;
    const double windowDuration;
};

#endif
