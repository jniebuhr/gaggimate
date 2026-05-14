import assert from 'node:assert/strict';
import test from 'node:test';

import { getGrindSettingsState } from './useGrindSettings.js';

test('grind is unavailable when settings have not loaded', () => {
  const state = getGrindSettingsState(null);

  assert.equal(state.altRelayFunction, 0);
  assert.equal(state.isGrindAvailable, false);
  assert.equal(state.showGrindTab, false);
});

test('grind is available when alt relay is explicitly configured for grind', () => {
  const state = getGrindSettingsState({ smartGrindActive: false, altRelayFunction: 1 });

  assert.equal(state.isGrindAvailable, true);
  assert.equal(state.showGrindTab, true);
});

test('grind is available when smart grind is active', () => {
  const state = getGrindSettingsState({ smartGrindActive: true, altRelayFunction: 0 });

  assert.equal(state.isGrindAvailable, true);
  assert.equal(state.showGrindTab, true);
});
