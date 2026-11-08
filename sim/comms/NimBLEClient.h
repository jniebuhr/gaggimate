// Minimal stand-in for the NimBLE client handle. GaggiMateClient::getClient()
// returns one; the firmware only reads isConnected()/getRssi() (status + OTA).
#pragma once

class NimBLEClient {
  public:
    bool isConnected() const { return true; }
    int getRssi() const { return -50; }
};
