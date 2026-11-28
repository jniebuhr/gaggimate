import assert from 'node:assert/strict';
import test from 'node:test';
import { clampLiveBrewSetpoint, liveBrewLimitsAreValid, liveBrewStartIsSafe } from '../src/utils/liveBrew.js';

test('Live Brew requires firmware-advertised finite limits', () => {
  assert.equal(liveBrewLimitsAreValid({ minPressure: 0, maxPressure: 16, minFlow: 0, maxFlow: 10 }), true);
  assert.equal(liveBrewLimitsAreValid({ minPressure: 0, maxPressure: 16 }), false);
  assert.equal(liveBrewLimitsAreValid({ minPressure: 0, maxPressure: 0, minFlow: 0, maxFlow: 10 }), false);
});

test('Live Brew setpoints clamp to advertised limits and reject invalid values', () => {
  assert.equal(clampLiveBrewSetpoint(-1, 0, 16), 0);
  assert.equal(clampLiveBrewSetpoint(20, 0, 16), 16);
  assert.equal(clampLiveBrewSetpoint(9.5, 0, 16), 9.5);
  assert.equal(clampLiveBrewSetpoint(Number.NaN, 0, 16), null);
});

test('Live Brew start is gated by connection, readiness, capability, and limits', () => {
  const limits = { minPressure: 0, maxPressure: 16, minFlow: 0, maxFlow: 10 };
  assert.equal(liveBrewStartIsSafe({ connected: true, systemReady: true, available: true, limits }), true);
  assert.equal(liveBrewStartIsSafe({ connected: false, systemReady: true, available: true, limits }), false);
  assert.equal(liveBrewStartIsSafe({ connected: true, systemReady: false, available: true, limits }), false);
  assert.equal(liveBrewStartIsSafe({ connected: true, systemReady: true, available: false, limits }), false);
});
