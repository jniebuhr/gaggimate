import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODE_GRIND,
  MODE_MANUAL,
  MODE_STEAM,
  clampManualFlow,
  clampManualPressure,
  clampManualTemperature,
  getAvailableModeOptions,
  getBoilerHeatingState,
  getManualControlLabels,
  getPrimaryActionState,
  getProcessKindForMode,
  getTemperatureRingMetrics,
  shouldKeepManualDraftDirty,
  shouldSendManualUpdate,
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

test('available mode options omit unavailable optional modes', () => {
  const options = getAvailableModeOptions(false, false);

  assert.deepEqual(
    options.map(option => option.name),
    ['STANDBY', 'BREW', 'STEAM', 'WATER'],
  );
});

test('available mode options include manual before grind when grind is available', () => {
  const options = getAvailableModeOptions(true, true);

  assert.deepEqual(
    options.map(option => option.name),
    ['STANDBY', 'BREW', 'STEAM', 'WATER', 'MANUAL', 'GRIND'],
  );
});

test('available mode options include manual when only grind is unavailable', () => {
  const options = getAvailableModeOptions(false, true);

  assert.deepEqual(
    options.map(option => option.name),
    ['STANDBY', 'BREW', 'STEAM', 'WATER', 'MANUAL'],
  );
});

test('manual mode process kind is manual', () => {
  assert.equal(getProcessKindForMode(MODE_MANUAL), 'manual');
});

test('manual mode is unavailable without pressure capability', () => {
  assert.equal(getProcessKindForMode(MODE_MANUAL, true, false), null);

  const state = getPrimaryActionState({
    active: false,
    finished: false,
    mode: MODE_MANUAL,
    isManualAvailable: false,
  });

  assert.equal(state.label, 'MANUAL UNAVAILABLE');
  assert.equal(state.action, 'noop');
  assert.equal(state.processKind, null);
});

test('manual primary action starts manual when armed', () => {
  const state = getPrimaryActionState({
    active: false,
    finished: false,
    mode: MODE_MANUAL,
  });

  assert.equal(state.label, 'START MANUAL');
  assert.equal(state.action, 'start-process');
  assert.equal(state.processKind, 'manual');
});

test('manual primary action stops manual when running', () => {
  const state = getPrimaryActionState({
    active: true,
    finished: false,
    mode: MODE_MANUAL,
  });

  assert.equal(state.label, 'STOP MANUAL');
  assert.equal(state.action, 'deactivate');
  assert.equal(state.processKind, null);
});

test('manual primary action clears manual when finished', () => {
  const state = getPrimaryActionState({
    active: false,
    finished: true,
    mode: MODE_MANUAL,
  });

  assert.equal(state.label, 'CLEAR');
  assert.equal(state.action, 'clear');
});

test('manual target labels change with target type', () => {
  assert.deepEqual(getManualControlLabels('pressure'), {
    pressure: 'PRESSURE TARGET',
    flow: 'FLOW LIMIT',
  });
  assert.deepEqual(getManualControlLabels('flow'), {
    pressure: 'PRESSURE LIMIT',
    flow: 'FLOW TARGET',
  });
});

test('manual target values are clamped to first-version bounds', () => {
  assert.equal(clampManualTemperature(70), 80);
  assert.equal(clampManualTemperature(110), 105);
  assert.equal(clampManualPressure(-1), 0);
  assert.equal(clampManualPressure(15), 12);
  assert.equal(clampManualFlow(-1), 0);
  assert.equal(clampManualFlow(7), 6);
});

test('manual temperature updates send before start while pump controls stay staged', () => {
  assert.equal(shouldSendManualUpdate({
    active: false,
    isManualMode: true,
    partial: { temperature: 94 },
  }), true);
  assert.equal(shouldSendManualUpdate({
    active: false,
    isManualMode: true,
    partial: { pressure: 8 },
  }), false);
  assert.equal(shouldSendManualUpdate({
    active: true,
    isManualMode: true,
    partial: { pressure: 8 },
  }), true);
});

test('manual pre-start edits keep the local draft stable until start', () => {
  assert.equal(shouldKeepManualDraftDirty({
    active: false,
    partial: { temperature: 94 },
  }), true);
  assert.equal(shouldKeepManualDraftDirty({
    active: false,
    partial: { pressure: 8 },
  }), true);
  assert.equal(shouldKeepManualDraftDirty({
    active: true,
    partial: { temperature: 94 },
  }), false);
});

test('manual mode heats like brew before the process starts', () => {
  assert.equal(getBoilerHeatingState({
    mode: MODE_MANUAL,
    active: false,
    finished: false,
    targetTemp: 94,
    tempVal: 88,
  }), true);
  assert.equal(getBoilerHeatingState({
    mode: MODE_MANUAL,
    active: true,
    finished: false,
    targetTemp: 94,
    tempVal: 88,
  }), false);
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
