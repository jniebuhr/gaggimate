#ifndef BLE_CLIENT_H
#define BLE_CLIENT_H

#include <Arduino.h>
#include <functional>
#include <NimBLEDevice.h>

// Transport-agnostic callback for raw data received
using ble_data_callback_t = std::function<void(const uint8_t* data, size_t length)>;

/**
 * Pure BLE client transport layer.
 * This class handles BLE connection and data transmission but doesn't know about protocols.
 * It can send/receive raw byte arrays over BLE characteristics.
 */
class BLETransportClient : public NimBLEAdvertisedDeviceCallbacks, NimBLEClientCallbacks {
public:
    BLETransportClient();
    ~BLETransportClient();
    
    // Connection management
    void initClient();
    bool connectToServer();
    bool isConnected() const;
    bool isReadyForConnection() const;
    void scan();
    void disconnect();
    
    // Raw data transmission
    bool sendData(const uint8_t* data, size_t length);
    
    // Register callback for received data
    void registerDataCallback(const ble_data_callback_t& callback);
    
    // Note: getDeviceInfo() removed - using nanopb messages for system info
    NimBLEClient* getNativeClient() const { return client; }

private:
    bool deviceConnected;
    NimBLEClient* client;
    NimBLERemoteCharacteristic* rx_char = nullptr;  // For receiving data
    NimBLERemoteCharacteristic* tx_char = nullptr;  // For sending data
    // Note: info_char removed - using nanopb messages for system info
    NimBLEAdvertisedDevice* serverDevice = nullptr;
    unsigned long serverDeviceFoundTime = 0;
    
    bool readyForConnection = false;
    ble_data_callback_t data_callback = nullptr;
    String lastOutputControl = "";
    
    // BLE callback overrides
    void onResult(NimBLEAdvertisedDevice* advertisedDevice) override;
    void onConnect(NimBLEClient* pClient) override;
    void onDisconnect(NimBLEClient* pClient) override;
    
    // Characteristic callback
    void handleNotifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, 
                             uint8_t* pData, size_t length, bool isNotify);
    static void notifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, 
                              uint8_t* pData, size_t length, bool isNotify);
    
    // Static instance for callback handling
    static BLETransportClient* instance;
    
    // Service and characteristic UUIDs
    static const char* SERVICE_UUID;
    static const char* RX_CHAR_UUID;  // For receiving data from server
    static const char* TX_CHAR_UUID;  // For sending data to server
    // Note: INFO_CHAR_UUID removed - using nanopb messages for system info
};

#endif // BLE_CLIENT_H