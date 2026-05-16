import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addKeyframeAtTime,
  keyframesToProfile,
  moveKeyframeTime,
  profileToKeyframes,
  removeKeyframeAtIndex,
  updateKeyframeSegment,
} from './keyframeProfileLogic.js';

const baseProfile = {
  label: 'Keyframe Espresso',
  type: 'pro',
  temperature: 93,
  phases: [
    {
      name: 'Start',
      phase: 'preinfusion',
      valve: 1,
      pump: { target: 'pressure', pressure: 9, flow: 4 },
      duration: 0,
      transition: { type: 'instant', duration: 0, adaptive: true },
      targets: [],
      temperature: 90,
    },
    {
      name: 'Ramp Down',
      phase: 'brew',
      valve: 1,
      pump: { target: 'pressure', pressure: 6, flow: 4 },
      duration: 10,
      transition: { type: 'linear', duration: 10, adaptive: true },
      targets: [],
      temperature: 90,
    },
  ],
};

test('converts profile phases to persisted keyframe markers', () => {
  const markers = profileToKeyframes(baseProfile);

  assert.deepEqual(markers.map(marker => marker.time), [0, 10]);
  assert.equal(markers[0].temperature, 90);
  assert.equal(markers[0].pressure, 9);
  assert.equal(markers[0].flow, 4);
  assert.equal(markers[1].pressure, 6);
  assert.equal(markers[1].rampType, 'linear');
});

test('converts legacy profiles without a setup phase by synthesizing a start marker', () => {
  const legacy = {
    ...baseProfile,
    phases: baseProfile.phases.slice(1),
  };
  const markers = profileToKeyframes(legacy);

  assert.deepEqual(markers.map(marker => marker.time), [0, 10]);
  assert.equal(markers[0].pressure, 6);
  assert.equal(markers[1].pressure, 6);
});

test('writes initial keyframe as zero-second setup phase', () => {
  const profile = keyframesToProfile(baseProfile, profileToKeyframes(baseProfile));

  assert.equal(profile.phases[0].duration, 0);
  assert.equal(profile.phases[0].pump.pressure, 9);
  assert.equal(profile.phases[1].duration, 10);
  assert.equal(profile.phases[1].pump.target, 'pressure');
  assert.equal(profile.phases[1].transition.type, 'linear');
});

test('adding a marker splits the matching segment and keeps sorted time', () => {
  const result = addKeyframeAtTime(baseProfile, 4);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 4, 6]);
  assert.equal(result.selectedSegmentIndex, 1);
});

test('moving a marker changes adjacent durations without crossing neighbors', () => {
  const withMarker = addKeyframeAtTime(baseProfile, 4).profile;
  const result = moveKeyframeTime(withMarker, 1, 7);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 7, 3]);
});

test('removing an interior marker merges the neighboring time span', () => {
  const withMarker = addKeyframeAtTime(baseProfile, 4).profile;
  const result = removeKeyframeAtIndex(withMarker, 1);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 10]);
  assert.equal(result.selectedSegmentIndex, 0);
});

test('editing segment target mode preserves the other value as a limit', () => {
  const result = updateKeyframeSegment(baseProfile, 0, {
    targetMode: 'flow',
    pressure: 8,
    flow: 3.2,
    rampType: 'ease-out',
  });

  const phase = result.profile.phases[1];
  assert.equal(phase.pump.target, 'flow');
  assert.equal(phase.pump.pressure, 8);
  assert.equal(phase.pump.flow, 3.2);
  assert.equal(phase.transition.type, 'ease-out');
  assert.equal(phase.transition.duration, 10);
});
