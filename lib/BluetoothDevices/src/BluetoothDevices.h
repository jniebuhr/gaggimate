#pragma once
#include "BluetoothDevice.h"
#include "BluetoothDeviceRegistry.h"
#include "BluetoothDeviceScanner.h"
#include "BluetoothGrinder.h"
#include "BluetoothScale.h"

namespace BluetoothDevices {
// Registers every driver that ships with the library; safe to call more than once.
void registerBuiltinDrivers();
} // namespace BluetoothDevices
