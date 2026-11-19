import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeviceList, deviceModelName, deviceStates } from '../src/utils/bluetoothDevices.js';

const SCALE = 'aa:aa:aa:aa:aa:01';
const GRINDER = 'aa:aa:aa:aa:aa:02';

function info({ scale = {}, grinder = {} } = {}) {
  const base = { connected: false, name: '', uuid: '', rssi: 0, saved: '', savedName: '' };
  return {
    ...base,
    ...scale,
    devices: [
      { type: 'scale', ...base, ...scale },
      { type: 'grinder', ...base, ...grinder },
    ],
  };
}

test('firmware without device types reports a single scale', () => {
  const legacy = { connected: true, name: 'BOOKOO_SC 1', uuid: SCALE, saved: SCALE };
  assert.deepEqual(
    deviceStates(legacy).map(state => state.type),
    ['scale'],
  );
  const rows = buildDeviceList(legacy, [{ uuid: 'other', name: 'LUNAR-1' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'scale');
  assert.equal(rows[0].connected, true);
});

test('untyped discovered devices count as scales', () => {
  const rows = buildDeviceList({ connected: false, saved: '' }, [{ uuid: SCALE, name: 'LUNAR-1' }]);
  assert.equal(rows[0].type, 'scale');
  assert.equal(rows[0].saved, false);
});

test('a connected scale hides other scales but keeps grinders connectable', () => {
  const rows = buildDeviceList(
    info({ scale: { connected: true, name: 'BOOKOO_SC 1', uuid: SCALE, saved: SCALE } }),
    [
      { uuid: 'other-scale', name: 'LUNAR-1', type: 'scale' },
      { uuid: GRINDER, name: 'BOOKOO MT80 0A1B2C3D', type: 'grinder' },
    ],
  );
  assert.deepEqual(
    rows.map(row => [row.type, row.uuid, row.connected]),
    [
      ['scale', SCALE, true],
      ['grinder', GRINDER, false],
    ],
  );
});

test('both device types can be connected at once', () => {
  const rows = buildDeviceList(
    info({
      scale: { connected: true, uuid: SCALE, saved: SCALE },
      grinder: { connected: true, uuid: GRINDER, saved: GRINDER },
    }),
    [],
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
    info({ grinder: { saved: GRINDER, savedName: 'BOOKOO MT80 0A1B2C3D' } }),
    [{ uuid: SCALE, name: 'LUNAR-1', type: 'scale' }],
  );
  assert.equal(rows[0].uuid, GRINDER);
  assert.equal(rows[0].outOfRange, true);
  assert.equal(rows[0].name, 'BOOKOO MT80 0A1B2C3D');
  assert.equal(rows[1].uuid, SCALE);
});

test('a saved device in range is listed once, ahead of unknown devices', () => {
  const rows = buildDeviceList(info({ scale: { saved: SCALE } }), [
    { uuid: 'other-scale', name: 'LUNAR-1', type: 'scale' },
    { uuid: SCALE, name: 'BOOKOO_SC 1', type: 'scale' },
  ]);
  assert.deepEqual(
    rows.map(row => [row.uuid, row.saved, !!row.outOfRange]),
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
