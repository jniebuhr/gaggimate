import { scaleModelName } from './scaleModels.js';

// Device types the firmware can connect, one device per type; order is the display order.
export const DEVICE_TYPES = ['scale', 'grinder'];

// Advertised BLE name prefix → friendly grinder model name; mirrors the BluetoothDevices library matchers.
const GRINDER_MODELS = [[/^BOOKOO MT80/i, 'Bookoo Motto 80']];

// Firmware without device types only knows scales and sends no type at all.
export function deviceType(device) {
  return DEVICE_TYPES.includes(device?.type) ? device.type : 'scale';
}

export function deviceModelName(bleName, type) {
  if (!bleName) return null;
  if (type === 'grinder') {
    const match = GRINDER_MODELS.find(([pattern]) => pattern.test(bleName));
    return match ? match[1] : null;
  }
  return scaleModelName(bleName);
}

// Per-type connection state from /api/scales/info; older firmware reports only the scale, as top-level fields.
export function deviceStates(info) {
  if (!info) return [];
  if (Array.isArray(info.devices)) {
    return info.devices.map(device => ({ ...device, type: deviceType(device) }));
  }
  return [{ ...info, type: 'scale' }];
}

// Rows for the Bluetooth tab: connected devices, then nearby ones, plus saved devices that are out of range.
export function buildDeviceList(info, discovered = []) {
  const states = deviceStates(info);
  const connectedTypes = new Set(states.filter(state => state.connected).map(state => state.type));
  const rows = states
    .filter(state => state.connected)
    .map(state => ({ ...state, saved: true, connected: true }));

  const nearby = [];
  for (const device of discovered) {
    const type = deviceType(device);
    // One device per type: nothing else of that type can be connected while one is.
    if (connectedTypes.has(type)) continue;
    const saved = states.find(state => state.type === type)?.saved;
    nearby.push({ ...device, type, connected: false, saved: !!saved && device.uuid === saved });
  }

  for (const state of states) {
    if (state.connected || !state.saved) continue;
    if (nearby.some(device => device.type === state.type && device.saved)) continue;
    // Saved but not advertising: keep it listed so it can still be forgotten.
    nearby.push({
      uuid: state.saved,
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
