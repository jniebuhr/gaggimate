// FlowMap.h
#ifndef FLOW_MAP_H
#define FLOW_MAP_H

#include <algorithm>

class FlowMap {
  public:
    // Bilinear flow map: RPM + pressure -> pump flow (ml/min).
    static constexpr int NUM_RPM = 7;
    static constexpr int NUM_PRESSURE = 21;

    static constexpr float rpmAxis[NUM_RPM] = {1000, 1500, 2000, 2500, 3000, 3500, 4000};

    static constexpr float pressureAxis[NUM_PRESSURE] = {0,  1,  2,  3,  4,  5,  6,  7,  8,  9,  10,
                                                         11, 12, 13, 14, 15, 16, 17, 18, 19, 20};

    // Flow table [pressure][rpm] in ml/min
    static constexpr float flowTable[NUM_PRESSURE][NUM_RPM] = {
        {375, 575, 725, 900, 1100, 1250, 1500}, // 0 bar
        {300, 500, 675, 850, 1025, 1200, 1450},
        {225, 400, 600, 800, 975, 1075, 1400},
        {175, 350, 550, 750, 925, 1125, 1350},
        {125, 300, 500, 700, 875, 1075, 1300},
        {75, 250, 450, 650, 850, 1050, 1250},
        {0, 225, 425, 625, 800, 1000, 1225},
        {0, 175, 375, 575, 750, 975, 1175},
        {0, 125, 350, 525, 725, 925, 1150},
        {0, 100, 300, 500, 700, 875, 1100},
        {0, 75, 275, 475, 650, 850, 1075},
        {0, 0, 250, 450, 625, 800, 1050},
        {0, 0, 225, 425, 575, 775, 1000},
        {0, 0, 175, 375, 550, 725, 950},
        {0, 0, 0, 350, 500, 675, 925},
        {0, 0, 0, 325, 475, 650, 875},
        {0, 0, 0, 300, 450, 625, 850},
        {0, 0, 0, 0, 425, 575, 800},
        {0, 0, 0, 0, 0, 550, 775},
        {0, 0, 0, 0, 0, 500, 750},
        {0, 0, 0, 0, 0, 475, 700},
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
