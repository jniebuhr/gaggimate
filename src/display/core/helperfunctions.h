
#ifndef HELPERFUNCTIONS_H
#define HELPERFUNCTIONS_H

inline double SlopeLinearFitSeconds(const std::vector<double> &measurements, const std::vector<double> &measurementTimes, const double PREDICTIVE_TIME) {
  //perform a linear fit through the last PREDICTIVE_TIME (ms) of data time & measurement data and return the slope
  if (measurements.size()<2) return 0.0;

  size_t i = measurementTimes.size();
  double cutoff= millis()-PREDICTIVE_TIME;
  while (measurementTimes[i-1]>cutoff) {//check from the most recent time
    i--;
  }
  // i is the index of the first entry after the cutoff

  if (measurements.size()-i<2) return 0.0;

  double v_mean = 0.0;
  double t_mean = 0.0;
  for (size_t j=i; j< measurements.size(); j++) {
    v_mean += measurements[j];
    t_mean += measurementTimes[j];
  }
  v_mean = v_mean / (measurements.size()-i);
  t_mean = t_mean / (measurements.size()-i);

  double tdev2 = 0.0;
  double tdev_vdev = 0.0;
  for (size_t j=i; j< measurements.size(); j++) {
    tdev_vdev += (measurementTimes[i]-t_mean)*(measurements[i]-v_mean);
    tdev2 += pow(measurementTimes[i]-t_mean,2.0);
  }
  double volumePerMilliSecond=tdev_vdev/tdev2;//the slope (volume per millisecond) of the linear best fit
  return volumePerMilliSecond>0 ? volumePerMilliSecond * 1000.0 : 0.0; // return 0 if it is not positive, convert to seconds
}

#endif //HELPERFUNCTIONS_H
