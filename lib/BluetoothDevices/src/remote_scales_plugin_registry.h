#pragma once
#include "remote_scales.h"

struct RemoteScalesPlugin {
  using RemoteScalesFilter = bool (*)(const DiscoveredDevice& device);
  using RemoteScalesInitialiser = std::unique_ptr<RemoteScales> (*)(const DiscoveredDevice& device);
  std::string id;
  RemoteScalesFilter handles;
  RemoteScalesInitialiser initialise;
};

class RemoteScalesPluginRegistry {
public:
  static RemoteScalesPluginRegistry* getInstance() {
    if (instance == nullptr) {
      instance = new RemoteScalesPluginRegistry();
    }
    return instance;
  }

  RemoteScalesPluginRegistry(RemoteScalesPluginRegistry& other) = delete;
  void operator=(const RemoteScalesPluginRegistry&) = delete;

  void registerPlugin(RemoteScalesPlugin plugin);
  bool containsPluginForDevice(const DiscoveredDevice& device);
  std::unique_ptr<RemoteScales> initialiseRemoteScales(const DiscoveredDevice& device);

private:
  static RemoteScalesPluginRegistry* instance;
  std::vector<RemoteScalesPlugin> plugins;
  RemoteScalesPluginRegistry() {}  // Private constructor to enforce singleton
};
