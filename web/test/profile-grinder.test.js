import assert from 'node:assert/strict';
import test from 'node:test';
import { updateGrinderSettings } from '../src/pages/ProfileEdit/grinderSettings.js';

test('values are stored as numbers', () => {
  assert.deepEqual(updateGrinderSettings(undefined, 'rpm', '700'), { rpm: 700 });
  assert.deepEqual(updateGrinderSettings({ rpm: 700 }, 'grindSize', '2.5'), {
    rpm: 700,
    grindSize: 2.5,
  });
});

test('clearing a field removes its key', () => {
  assert.deepEqual(updateGrinderSettings({ rpm: 700, feedRpm: 65 }, 'rpm', ''), { feedRpm: 65 });
});

test('clearing the last field removes the grinder settings', () => {
  assert.equal(updateGrinderSettings({ rpm: 700 }, 'rpm', ''), undefined);
});

test('negative and non-numeric input is treated as empty', () => {
  assert.equal(updateGrinderSettings(undefined, 'rpm', '-5'), undefined);
  assert.equal(updateGrinderSettings(undefined, 'rpm', 'abc'), undefined);
});

test('zero is a valid grind size', () => {
  assert.deepEqual(updateGrinderSettings(undefined, 'grindSize', '0'), { grindSize: 0 });
});
