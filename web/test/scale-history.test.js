import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBinaryShot } from '../src/pages/ShotHistory/parseBinaryShot.js';
import { getBluetoothScaleConnectionState } from '../src/pages/ShotAnalyzer/services/analyzer/scaleConnection.js';

function fixture(version, size, flags, elapsed = true) {
  const buffer = new ArrayBuffer(512 + size * 2);
  const view = new DataView(buffer);
  view.setUint32(0, 0x544f4853, true);
  view.setUint8(4, version);
  view.setUint8(5, size);
  view.setUint16(6, 512, true);
  view.setUint16(8, 250, true);
  view.setUint32(12, size === 30 ? 0x3fff : 0x1fff, true);
  view.setUint32(16, 2, true);
  view.setUint32(20, 500, true);
  view.setUint16(108, 123, true);
  for (let i = 0; i < 2; i++) {
    const base = 512 + i * size;
    if (elapsed) view.setUint32(base, (i + 1) * 250, true);
    else view.setUint16(base, i + 1, true);
    const values = base + (elapsed ? 4 : 2);
    view.setUint16(values + 2, 935, true); // current temperature
    view.setUint16(values + 6, 87, true); // current pressure
    view.setInt16(values + 8, 245, true); // pump flow
    view.setUint16(values + 16, 120, true); // active weight
    view.setUint16(values + 22, flags, true);
    if (size === 30) view.setUint16(values + 24, 456, true);
  }
  return buffer;
}

for (const [name, version, size, flags, elapsed, connected] of [
  ['legacy v5', 5, 26, 4, false, true],
  ['legacy hardware-scale v6', 6, 26, 0x100, false, true],
  ['upstream v6', 6, 28, 4, true, true],
  ['upstream v7', 7, 30, 4, true, true],
  ['new hardware-scale v8', 8, 30, 0x100, true, true],
  ['v8 disconnected active scale with Bluetooth still connected', 8, 30, 4, true, false],
]) {
  test(`decode ${name}`, () => {
    const shot = parseBinaryShot(fixture(version, size, flags, elapsed), 'test');
    assert.deepEqual(
      shot.samples.map(s => s.t),
      [250, 500],
    );
    assert.equal(shot.samples[0].ct, 93.5);
    assert.equal(shot.samples[0].cp, 8.7);
    assert.equal(shot.samples[0].fl, 2.45);
    assert.equal(shot.samples[0].v, 12);
    assert.equal(shot.volume, 12.3); // preserve extended-recording final weight
    assert.equal(shot.samples[0].systemInfo.activeScaleConnected, connected);
    assert.equal(shot.samples[0].wp, size === 30 ? 45.6 : undefined);
    assert.equal(shot.incomplete, false);
  });
}

test('reject malformed timestamp layout', () => {
  const buffer = fixture(8, 30, 0x100);
  new DataView(buffer).setUint8(5, 26);
  assert.throws(() => parseBinaryShot(buffer, 'bad'), /device reports/);
});

test('active hardware scale does not count as Bluetooth loss', () => {
  const samples = [{ systemInfo: { activeScaleConnected: true, bluetoothScaleConnected: false } }];
  const state = getBluetoothScaleConnectionState(samples);
  assert.equal(state.scaleLost, false);
  const lost = getBluetoothScaleConnectionState(
    [{ systemInfo: { activeScaleConnected: false, bluetoothScaleConnected: true } }],
    state.bluetoothScaleWasConnected,
  );
  assert.equal(lost.scaleLost, true);
});

test('legacy JSON uses Bluetooth connection and does not invent a loss', () => {
  assert.equal(
    getBluetoothScaleConnectionState([{ systemInfo: { bluetoothScaleConnected: false } }])
      .scaleLost,
    false,
  );
  assert.equal(
    getBluetoothScaleConnectionState([
      { systemInfo: { bluetoothScaleConnected: true } },
      { systemInfo: { bluetoothScaleConnected: false } },
    ]).scaleLost,
    true,
  );
});
