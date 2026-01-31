// FlowMap.h
#ifndef FLOW_MAP_H
#define FLOW_MAP_H

#include <algorithm> // std::clamp, std::max
#include <cmath>     // std::isfinite (optional)

/**
 * FlowMap
 * -------
 * Converts (RPM, pressure [bar]) -> flow [ml/min] using a 2D map.
 *
 * Key fixes vs the original:
 *  1) Prevent out-of-bounds when rpm == max axis or pressure == max axis.
 *  2) Handle trailing zeros in rows as "unreachable/missing" (common in datasheet maps),
 *     so they do NOT pull interpolation down to 0 artificially.
 *
 * Policy for zeros:
 *  - Leading zeros (at low RPM / high pressure) are treated as true "no flow / stall".
 *  - Trailing zeros (after positive values) are treated as missing/unreachable -> clamp to last positive.
 */
class FlowMap {
public:
  // Bilinear-ish map: we do "row interpolation in RPM" with zero-handling,
  // then interpolate between the two nearest pressure rows.
  static constexpr int NUM_RPM = 10;
  static constexpr int NUM_PRESSURE = 17;

  static constexpr float rpmAxis[NUM_RPM] = {
      600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000};

  static constexpr float pressureAxis[NUM_PRESSURE] = {
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16};

  // Flow table [pressureIndex][rpmIndex] in ml/min
  // IMPORTANT: Keep your existing values as-is.
  static constexpr float flowTable[NUM_PRESSURE][NUM_RPM] = {
      {200, 375, 555, 720, 910, 1100, 1300, 1485, 1665, 1795}, // 0 bar
      {80, 255, 450, 640, 830, 1020, 1220, 1405, 1600, 1760},  // 1 bar
      {0, 170, 340, 555, 745, 950, 1140, 1335, 1530, 0},       // 2 bar
      {0, 75, 270, 480, 670, 875, 1065, 1260, 1460, 0},        // 3 bar
      {0, 20, 190, 400, 605, 815, 1005, 1210, 1410, 0},        // 4 bar
      {0, 0, 125, 355, 545, 755, 945, 1165, 1360, 0},          // 5 bar
      {0, 0, 70, 290, 505, 705, 890, 1110, 0, 0},              // 6 bar
      {0, 0, 30, 230, 435, 640, 835, 1040, 0, 0},              // 7 bar
      {0, 0, 0, 175, 385, 590, 790, 995, 0, 0},                // 8 bar
      {0, 0, 0, 120, 335, 545, 745, 955, 0, 0},                // 9 bar
      {0, 0, 0, 80, 295, 495, 700, 0, 0, 0},                   // 10 bar
      {0, 0, 0, 40, 250, 455, 640, 0, 0, 0},                   // 11 bar
      {0, 0, 0, 0, 210, 420, 605, 0, 0, 0},                     // 12 bar
      {0, 0, 0, 0, 170, 390, 0, 0, 0, 0},                       // 13 bar
      {0, 0, 0, 0, 130, 350, 0, 0, 0, 0},                       // 14 bar
      {0, 0, 0, 0, 100, 0, 0, 0, 0, 0},                         // 15 bar
      {0, 0, 0, 0, 80, 0, 0, 0, 0, 0},                          // 16 bar
  };

  /**
   * getFlow(rpm, pressureBar) -> flow ml/min
   *
   * - Input is clamped to axis bounds.
   * - Pressure indexing is guaranteed safe (iP in [0..NUM_PRESSURE-2]).
   * - For each pressure row, RPM interpolation ignores trailing zeros:
   *     rpm >= lastPositiveRPM => returns lastPositiveFlow (clamp).
   *   Leading zeros remain "no flow".
   */
  static float getFlow(float rpm, float pressureBar) {
    // Clamp inputs to map range
    rpm = std::clamp(rpm, rpmAxis[0], rpmAxis[NUM_RPM - 1]);
    pressureBar = std::clamp(pressureBar, pressureAxis[0], pressureAxis[NUM_PRESSURE - 1]);

    // Find pressure segment index iP such that:
    // pressureAxis[iP] <= pressureBar <= pressureAxis[iP+1]
    // iP must be <= NUM_PRESSURE-2 to safely access iP+1
    int iP = 0;
    while (iP < (NUM_PRESSURE - 2) && pressureAxis[iP + 1] <= pressureBar) {
      ++iP;
    }

    const float p1 = pressureAxis[iP];
    const float p2 = pressureAxis[iP + 1];
    const float denomP = (p2 - p1);
    const float u = (denomP > 0.0f) ? (pressureBar - p1) / denomP : 0.0f;

    // Interpolate flow in RPM for the two bracketing pressure rows
    const float qP1 = interpRowFlowWithZeroPolicy(iP, rpm);
    const float qP2 = interpRowFlowWithZeroPolicy(iP + 1, rpm);

    // Interpolate between pressures
    const float q = qP1 + u * (qP2 - qP1);
    return std::max(0.0f, q);
  }

private:
  // Returns the first index with flow > 0 in the row, or -1 if none.
  static int firstPositiveIndex(int pIdx) {
    for (int j = 0; j < NUM_RPM; ++j) {
      if (flowTable[pIdx][j] > 0.0f) return j;
    }
    return -1;
  }

  // Returns the last index with flow > 0 in the row, or -1 if none.
  static int lastPositiveIndex(int pIdx) {
    for (int j = NUM_RPM - 1; j >= 0; --j) {
      if (flowTable[pIdx][j] > 0.0f) return j;
    }
    return -1;
  }

  /**
   * Interpolate within a single pressure row as function of RPM, with zero-policy:
   * - If rpm is below the first positive point => return 0 (stall/no flow).
   * - If rpm is above/equal the last positive point => clamp to last positive flow
   *   (treat trailing zeros as missing/unreachable, not real 0).
   * - Otherwise interpolate between nearest axis points.
   *
   * This avoids the "interpolation dragged to 0" problem caused by trailing zeros.
   */
  static float interpRowFlowWithZeroPolicy(int pIdx, float rpm) {
    const int firstNZ = firstPositiveIndex(pIdx);
    const int lastNZ  = lastPositiveIndex(pIdx);

    if (firstNZ < 0 || lastNZ < 0) {
      // Entire row is zeros: treat as no flow
      return 0.0f;
    }

    // True no-flow region (leading zeros)
    if (rpm < rpmAxis[firstNZ]) {
      return 0.0f;
    }

    // Trailing-zero (unreachable/missing) region -> clamp
    if (rpm >= rpmAxis[lastNZ]) {
      return flowTable[pIdx][lastNZ];
    }

    // Find RPM segment within [firstNZ .. lastNZ-1]
    int iR = firstNZ;
    while (iR < (lastNZ - 1) && rpmAxis[iR + 1] <= rpm) {
      ++iR;
    }

    // We expect both endpoints to be > 0; but be defensive in case of gaps.
    float r1 = rpmAxis[iR];
    float q1 = flowTable[pIdx][iR];

    int iR2 = iR + 1;
    while (iR2 <= lastNZ && flowTable[pIdx][iR2] <= 0.0f) {
      ++iR2;
    }

    if (q1 <= 0.0f) {
      // Should not happen due to firstNZ logic, but safe fallback:
      return 0.0f;
    }

    if (iR2 > lastNZ) {
      // No valid point to the right -> clamp to q1
      return q1;
    }

    float r2 = rpmAxis[iR2];
    float q2 = flowTable[pIdx][iR2];

    const float denomR = (r2 - r1);
    const float t = (denomR > 0.0f) ? (rpm - r1) / denomR : 0.0f;

    // Linear interpolation
    const float q = q1 + t * (q2 - q1);
    return std::max(0.0f, q);
  }
};

#endif // FLOW_MAP_H