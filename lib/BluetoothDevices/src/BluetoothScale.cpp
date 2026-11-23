#include "BluetoothScale.h"

void BluetoothScale::setWeight(float newWeight) {
    float previousWeight = weight;
    weight = newWeight;

    if (weightCallback == nullptr) {
        return;
    }
    if (weightCallbackOnlyChanges && previousWeight == newWeight) {
        return;
    }
    weightCallback(newWeight);
}

void BluetoothScale::setWeightUpdatedCallback(void (*callback)(float), bool onlyChanges) {
    weightCallbackOnlyChanges = onlyChanges;
    this->weightCallback = callback;
}
