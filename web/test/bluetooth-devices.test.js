import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeviceList, deviceModelName } from '../src/utils/bluetoothDevices.js';

const SCALE = 'aa:aa:aa:aa:aa:01';
const GRINDER = 'aa:aa:aa:aa:aa:02';

// A res:bluetooth:devices answer with one state per device type.
function response({ scale = {}, grinder = {}, discovered = [] } = {}) {
  const base = { connected: false, name: '', address: '', rssi: 0, saved: '', savedName: '' };
  return {
    devices: [
      { type: 'scale', ...base, ...scale },
      { type: 'grinder', ...base, ...grinder },
    ],
    discovered,
  };
}

test('nothing paired and nothing nearby gives an empty list', () => {
  assert.deepEqual(buildDeviceList(response()), []);
  assert.deepEqual(buildDeviceList(), []);
});

test('a connected scale hides other scales but keeps grinders connectable', () => {
  const rows = buildDeviceList(
    response({
      scale: { connected: true, name: 'BOOKOO_SC 1', address: SCALE, saved: SCALE },
      discovered: [
        { address: 'other-scale', name: 'LUNAR-1', type: 'scale' },
        { address: GRINDER, name: 'BOOKOO MT80 0A1B2C3D', type: 'grinder' },
      ],
    }),
  );
  assert.deepEqual(
    rows.map(row => [row.type, row.address, row.connected]),
    [
      ['scale', SCALE, true],
      ['grinder', GRINDER, false],
    ],
  );
});

test('both device types can be connected at once', () => {
  const rows = buildDeviceList(
    response({
      scale: { connected: true, address: SCALE, saved: SCALE },
      grinder: { connected: true, address: GRINDER, saved: GRINDER },
    }),
  );
  assert.deepEqual(
    rows.map(row => [row.type, row.connected, row.saved]),
    [
      ['scale', true, true],
      ['grinder', true, true],
    ],
  );
});

test('a saved device that is not advertising stays listed as out of range', () => {
  const rows = buildDeviceList(
    response({
      grinder: { saved: GRINDER, savedName: 'BOOKOO MT80 0A1B2C3D' },
      discovered: [{ address: SCALE, name: 'LUNAR-1', type: 'scale' }],
    }),
  );
  assert.equal(rows[0].address, GRINDER);
  assert.equal(rows[0].outOfRange, true);
  assert.equal(rows[0].name, 'BOOKOO MT80 0A1B2C3D');
  assert.equal(rows[1].address, SCALE);
});

test('a saved device in range is listed once, ahead of unknown devices', () => {
  const rows = buildDeviceList(
    response({
      scale: { saved: SCALE },
      discovered: [
        { address: 'other-scale', name: 'LUNAR-1', type: 'scale' },
        { address: SCALE, name: 'BOOKOO_SC 1', type: 'scale' },
      ],
    }),
  );
  assert.deepEqual(
    rows.map(row => [row.address, row.saved, !!row.outOfRange]),
    [
      [SCALE, true, false],
      ['other-scale', false, false],
    ],
  );
});

test('model names resolve per device type', () => {
  assert.equal(deviceModelName('BOOKOO MT80 0A1B2C3D', 'grinder'), 'Bookoo Motto 80');
  assert.equal(deviceModelName('BOOKOO_SC_U 000001', 'scale'), 'Bookoo Themis Ultra');
  assert.equal(deviceModelName('Something else', 'grinder'), null);
});
