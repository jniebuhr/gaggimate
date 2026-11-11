import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeWaterLevel,
  parseTankDistance,
  validateTankCalibration,
} from '../src/utils/waterLevel.js';

test('parseTankDistance accepts zero and whole numbers, as numbers or strings', () => {
  assert.equal(parseTankDistance(0), 0);
  assert.equal(parseTankDistance('0'), 0);
  assert.equal(parseTankDistance('210'), 210);
  assert.equal(parseTankDistance(30), 30);
});

test('parseTankDistance rejects missing, blank, negative, fractional and non-numeric input', () => {
  for (const value of [undefined, null, '', '  ', 'abc', -1, '-5', 12.5, '12.5', NaN, Infinity]) {
    assert.equal(parseTankDistance(value), null, `expected ${String(value)} to be rejected`);
  }
});

test('validateTankCalibration accepts a full tank distance of 0', () => {
  assert.deepEqual(validateTankCalibration('210', '0'), { empty: null, full: null });
});

test('validateTankCalibration flags blank or invalid fields individually', () => {
  assert.deepEqual(validateTankCalibration('', '30'), { empty: 'invalid', full: null });
  assert.deepEqual(validateTankCalibration('210', 'abc'), { empty: null, full: 'invalid' });
  assert.deepEqual(validateTankCalibration('', ''), { empty: 'invalid', full: 'invalid' });
});

test('validateTankCalibration requires the empty distance to exceed the full distance', () => {
  assert.deepEqual(validateTankCalibration('30', '30'), { empty: 'order', full: null });
  assert.deepEqual(validateTankCalibration('20', '30'), { empty: 'order', full: null });
});

test('validateTankCalibration does not report an order error while a field is invalid', () => {
  assert.deepEqual(validateTankCalibration('', '0'), { empty: 'invalid', full: null });
});

test('computeWaterLevel scales the reading between the empty and full distances', () => {
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: 120 }), 50);
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: 210 }), 0);
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: 30 }), 100);
});

test('computeWaterLevel works with a full tank distance of 0', () => {
  assert.equal(computeWaterLevel({ empty: 200, full: 0, distance: 100 }), 50);
  assert.equal(computeWaterLevel({ empty: 200, full: 0, distance: 0 }), 100);
});

test('computeWaterLevel clamps readings outside the calibrated range', () => {
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: 500 }), 0);
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: 5 }), 100);
});

test('computeWaterLevel accepts calibration values stored as strings', () => {
  assert.equal(computeWaterLevel({ empty: '210', full: '30', distance: 120 }), 50);
});

test('computeWaterLevel returns null for an unusable calibration', () => {
  assert.equal(computeWaterLevel({ empty: 30, full: 30, distance: 30 }), null);
  assert.equal(computeWaterLevel({ empty: 20, full: 30, distance: 25 }), null);
  assert.equal(computeWaterLevel({ empty: undefined, full: 30, distance: 100 }), null);
  assert.equal(computeWaterLevel({ empty: 210, full: '', distance: 100 }), null);
});

test('computeWaterLevel returns null without a numeric reading', () => {
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: undefined }), null);
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: null }), null);
  assert.equal(computeWaterLevel({ empty: 210, full: 30, distance: NaN }), null);
});
