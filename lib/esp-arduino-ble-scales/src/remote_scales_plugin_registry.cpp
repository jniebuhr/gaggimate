#include "remote_scales_plugin_registry.h"

// ---------------------------------------------------------------------------------------
// ------------------------   RemoteScalesPluginRegistry    -------------------------------
// ---------------------------------------------------------------------------------------
RemoteScalesPluginRegistry* RemoteScalesPluginRegistry::instance = nullptr;

void RemoteScalesPluginRegistry::registerPlugin(RemoteScalesPlugin plugin) {
  // Check if a plugin with the same ID already exists
  for (const auto& existingPlugin : plugins) {
    if (existingPlugin.id == plugin.id) {
      return;
    }
  }

  plugins.push_back(plugin);
}

bool RemoteScalesPluginRegistry::containsPluginForDevice(const DiscoveredDevice& device) {
  for (const auto& plugin : plugins) {
    if (plugin.handles(device)) {
      return true;
    }
  }
  return false;
}

std::unique_ptr<RemoteScales> RemoteScalesPluginRegistry::initialiseRemoteScales(const DiscoveredDevice& device) {
  for (const auto& plugin : plugins) {
    if (plugin.handles(device)) {
      return plugin.initialise(device);
    }
  }
  return nullptr;
}

