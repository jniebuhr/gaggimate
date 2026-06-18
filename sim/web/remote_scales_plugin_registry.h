// Host shim for remote_scales_plugin_registry.h (esp-arduino-ble-scales).
#pragma once

class RemoteScalesPluginRegistry {
  public:
    static RemoteScalesPluginRegistry *getInstance() {
        static RemoteScalesPluginRegistry instance;
        return &instance;
    }
};
