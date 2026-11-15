#ifndef NANOPBCOMM_BLE_OTA_H
#define NANOPBCOMM_BLE_OTA_H

// Controller firmware update over its own GATT service on the comms link: the display writes RX, the controller notifies TX.
// Protocol: 0xFE size, 0xFF parts + packet size, 0xFD start (-> 0xAA mode), 0xFB packet, 0xFC flash part (-> 0xF1 / 0xF2).
// A failure is reported as 0x0F followed by a reason string.
namespace gm_ble_ota {

constexpr char SERVICE_UUID[] = "fe590001-54ae-4a28-9f74-dfccb248601d";
constexpr char RX_CHAR_UUID[] = "fe590002-54ae-4a28-9f74-dfccb248601d";
constexpr char TX_CHAR_UUID[] = "fe590003-54ae-4a28-9f74-dfccb248601d";

} // namespace gm_ble_ota

#endif // NANOPBCOMM_BLE_OTA_H
