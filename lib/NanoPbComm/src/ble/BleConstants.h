#ifndef NANOPBCOMM_BLE_CONSTANTS_H
#define NANOPBCOMM_BLE_CONSTANTS_H

#include <cstddef>
#include <cstdint>

// 247 + 4 byte L2CAP header fills exactly one 251 byte DLE link-layer PDU.
constexpr uint16_t BLE_MTU = 247;
constexpr uint16_t BLE_DLE_OCTETS = 251;
// Air time of a 251 byte PDU on the 1M PHY: (251 + 14) * 8 us.
constexpr uint16_t BLE_DLE_TIME_US = 2120;
// Largest single notify / write-without-response value (MTU minus the 3 byte ATT header).
constexpr size_t BLE_MAX_DATAGRAM = BLE_MTU - 3;

#endif // NANOPBCOMM_BLE_CONSTANTS_H
