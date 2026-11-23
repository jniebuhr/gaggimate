import { scaleModelName } from './scaleModels.js';

// Advertised BLE name prefix → friendly grinder model name; mirrors the BluetoothDevices library matchers.
const GRINDER_MODELS = [[/^BOOKOO MT80/i, 'Bookoo Motto 80']];

export function deviceModelName(bleName, type) {
  if (!bleName) return null;
  if (type === 'grinder') {
    const match = GRINDER_MODELS.find(([pattern]) => pattern.test(bleName));
    return match ? match[1] : null;
  }
  return scaleModelName(bleName);
}

// Rows for the Bluetooth tab from res:bluetooth:devices: connected devices, nearby ones, saved ones out of range.
export function buildDeviceList({ devices = [], discovered = [] } = {}) {
  const connectedTypes = new Set(devices.filter(state => state.connected).map(state => state.type));
  const rows = devices.filter(state => state.connected).map(state => ({ ...state, saved: true }));

  const nearby = [];
  for (const device of discovered) {
    // One device per type: nothing else of that type can be connected while one is.
    if (connectedTypes.has(device.type)) continue;
    const saved = devices.find(state => state.type === device.type)?.saved;
    nearby.push({ ...device, connected: false, saved: !!saved && device.address === saved });
  }

  for (const state of devices) {
    if (state.connected || !state.saved) continue;
    if (nearby.some(device => device.type === state.type && device.saved)) continue;
    // Saved but not advertising: keep it listed so it can still be forgotten.
    nearby.push({
      address: state.saved,
      name: state.savedName || '',
      type: state.type,
      connected: false,
      saved: true,
      outOfRange: true,
    });
  }

  nearby.sort((a, b) => Number(b.saved) - Number(a.saved));
  return [...rows, ...nearby];
}
