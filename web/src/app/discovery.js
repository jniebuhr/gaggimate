import { signal } from '@preact/signals';

// Native mDNS browser for _gaggimate._tcp (ios/App/App/MachineDiscoveryPlugin.swift, android MachineDiscoveryPlugin.java).
let MachineDiscovery = null;

// Loads @capacitor/core lazily so the firmware bundle never includes it; never return the plugin proxy from here.
async function loadPlugin() {
  if (MachineDiscovery) return;
  const { registerPlugin } = await import('@capacitor/core');
  MachineDiscovery = registerPlugin('MachineDiscovery');
}

// Machines currently visible on the network: [{ name, host, version }].
export const discoveredMachines = /* @__PURE__ */ signal([]);
// False when the platform has no native browser (e.g. the app build running in a desktop browser).
export const discoveryAvailable = /* @__PURE__ */ signal(true);

let listeners = [];

export async function startDiscovery() {
  await loadPlugin();
  await stopDiscovery();
  discoveredMachines.value = [];
  try {
    listeners = await Promise.all([
      MachineDiscovery.addListener('machineFound', machine => {
        discoveredMachines.value = [
          ...discoveredMachines.value.filter(m => m.name !== machine.name),
          machine,
        ];
      }),
      MachineDiscovery.addListener('machineLost', ({ name }) => {
        discoveredMachines.value = discoveredMachines.value.filter(m => m.name !== name);
      }),
    ]);
    await MachineDiscovery.start();
  } catch {
    discoveryAvailable.value = false;
  }
}

export async function stopDiscovery() {
  if (!MachineDiscovery) return;
  await Promise.all(listeners.map(listener => listener.remove()));
  listeners = [];
  try {
    await MachineDiscovery.stop();
  } catch {
    // Not running or unavailable on this platform.
  }
}
