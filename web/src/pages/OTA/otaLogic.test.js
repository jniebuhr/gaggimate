import assert from 'node:assert/strict';
import test from 'node:test';

import { updateOtaChannel } from './otaLogic.js';

test('updates OTA channel to nightly without changing other form fields', () => {
  const next = updateOtaChannel({ channel: 'latest', displayVersion: '2.0.3' }, 'nightly');

  assert.equal(next.channel, 'nightly');
  assert.equal(next.displayVersion, '2.0.3');
});

test('falls back to stable for unexpected OTA channel values', () => {
  const next = updateOtaChannel({ channel: 'nightly' }, 'beta');

  assert.equal(next.channel, 'latest');
});
