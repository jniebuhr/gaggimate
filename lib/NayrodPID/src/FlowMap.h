// FlowMap.h
#ifndef FLOW_MAP_H
#define FLOW_MAP_H

#include <algorithm>

class FlowMap {
  public:
    // Bilinear flow map: RPM + pressure -> pump flow (ml/min).
    static constexpr int NUM_RPM = 10;
    static constexpr int NUM_PRESSURE = 17;

    static constexpr float rpmAxis[NUM_RPM] = {600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000};

    static constexpr float pressureAxis[NUM_PRESSURE] = {0,  1,  2,  3,  4,  5,  6,  7,  8,  9,  10,
                                                         11, 12, 13, 14, 15, 16};

    // Flow table [pressure][rpm] in ml/min
    static constexpr float flowTable[NUM_PRESSURE][NUM_RPM] = {
        {200, 375, 555, 720, 910, 1100, 1300, 1485, 1665, 1795},    // 0 bar
        {80, 255, 450, 640, 830, 1020, 1220, 1405, 1600, 1760},     // 1 bar
        {0, 170, 340, 555, 745, 950, 1140, 1335, 1530, 0},          // 2 bar
        {0, 75, 270, 480, 670, 875, 1065, 1260, 1460, 0},           // 3 bar
        {0, 20, 190, 400, 605, 815, 1005, 1210, 1410, 0},           // 4 bar
        {0, 0, 125, 355, 545, 755, 945, 1165, 1360, 0},             // 5 bar
        {0, 0, 70, 290, 505, 705, 890, 1110, 0 , 0},                // 6 bar
        {0, 0, 30, 230, 435, 640, 835, 1040, 0, 0},                 // 7 bar
        {0, 0, 0, 175, 385, 590, 790, 995, 0, 0},                   // 8 bar
        {0, 0, 0, 120, 335, 545, 745, 955, 0, 0},                   // 9 bar
        {0, 0, 0, 80, 295, 495, 700, 0, 0, 0},                      // 10 bar
        {0, 0, 0, 40, 250, 455, 640, 0, 0, 0},                      // 11 bar
        {0, 0, 0, 0, 210, 420, 605, 0, 0, 0},                       // 12 bar
        {0, 0, 0, 0, 170, 390, 0, 0, 0, 0},                         // 13 bar
        {0, 0, 0, 0, 130, 350, 0, 0, 0, 0},                         // 14 bar
        {0, 0, 0, 0, 100, 0, 0, 0, 0, 0},                           // 15 bar
        {0, 0, 0, 0, 80, 0, 0, 0, 0, 0},                            // 16 bar
    };

    static float getFlow(float rpm, float pressureBar) {
        rpm = std::clamp(rpm, rpmAxis[0], rpmAxis[NUM_RPM - 1]);
        pressureBar = std::clamp(pressureBar, pressureAxis[0], pressureAxis[NUM_PRESSURE - 1]);

        int iP = 0;
        while (iP < NUM_PRESSURE - 1 && pressureAxis[iP + 1] <= pressureBar) {
            iP++;
        }

        int iR = 0;
        while (iR < NUM_RPM - 1 && rpmAxis[iR + 1] <= rpm) {
            iR++;
        }

        float p1 = pressureAxis[iP];
        float p2 = pressureAxis[iP + 1];
        float r1 = rpmAxis[iR];
        float r2 = rpmAxis[iR + 1];

        float q11 = flowTable[iP][iR];
        float q12 = flowTable[iP][iR + 1];
        float q21 = flowTable[iP + 1][iR];
        float q22 = flowTable[iP + 1][iR + 1];

        float t = (rpm - r1) / (r2 - r1);
        float u = (pressureBar - p1) / (p2 - p1);

        float qp1 = q11 + t * (q12 - q11);
        float qp2 = q21 + t * (q22 - q21);
        float q = qp1 + u * (qp2 - qp1);

        return std::max(0.0f, q);
    }
};

#endif
