import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODE_GRIND,
  MODE_STEAM,
  getAvailableModeOptions,
  getPrimaryActionState,
  getProcessKindForMode,
  getTemperatureRingMetrics,
} from './dashboardLogic.js';

test('steam temperature ring scales progress against the steam target', () => {
  const metrics = getTemperatureRingMetrics({
    mode: MODE_STEAM,
    tempVal: 105,
    targetTemp: 150,
  });

  assert.equal(metrics.progressFraction, 0.7);
  assert.equal(metrics.targetFraction, 1);
});

test('start steam is tracked as steam, not brew', () => {
  const state = getPrimaryActionState({
    active: false,
    finished: false,
    mode: MODE_STEAM,
  });

  assert.equal(state.label, 'START STEAM');
  assert.equal(state.action, 'start-process');
  assert.equal(state.processKind, 'steam');
});

test('water mode is not tracked as brew for auto-steam', () => {
  assert.equal(getProcessKindForMode(3), 'water');
});

test('grind mode is not selectable when grind is unavailable', () => {
  assert.equal(getProcessKindForMode(MODE_GRIND, false), null);
});

test('available mode options omit grind when grind is unavailable', () => {
  const options = getAvailableModeOptions(false);

  assert.deepEqual(
    options.map(option => option.name),
    ['STANDBY', 'BREW', 'STEAM', 'WATER'],
  );
});

test('primary action for unavailable grind mode does not start a process', () => {
  const state = getPrimaryActionState({
    active: false,
    finished: false,
    mode: MODE_GRIND,
    isGrindAvailable: false,
  });

  assert.equal(state.label, 'GRIND UNAVAILABLE');
  assert.equal(state.action, 'noop');
  assert.equal(state.processKind, null);
});

test('stop steam changes mode to standby and clears process tracking', () => {
  const state = getPrimaryActionState({
    active: true,
    finished: false,
    mode: MODE_STEAM,
  });

  assert.equal(state.label, 'STOP STEAM');
  assert.equal(state.action, 'change-mode');
  assert.equal(state.mode, 0);
  assert.equal(state.processKind, null);
});
