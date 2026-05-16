import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addKeyframeAtTime,
  keyframesToProfile,
  moveKeyframeTime,
  normalizeKeyframes,
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

test('adding a marker duplicates matching segment metadata without shifting later phases', () => {
  const profile = {
    ...baseProfile,
    phases: [
      {
        ...baseProfile.phases[0],
        valve: 1,
        targets: [{ curve: 'setup' }],
        transition: { type: 'instant', duration: 0, adaptive: true },
      },
      {
        ...baseProfile.phases[1],
        name: 'First Runnable',
        valve: 2,
        duration: 8,
        targets: [{ curve: 'first' }],
        transition: { type: 'linear', duration: 8, adaptive: false },
      },
      {
        ...baseProfile.phases[1],
        name: 'Second Runnable',
        valve: 3,
        duration: 12,
        targets: [{ curve: 'second' }],
        transition: { type: 'ease-in', duration: 12, adaptive: true },
      },
    ],
  };

  const result = addKeyframeAtTime(profile, 3);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 3, 5, 12]);
  assert.deepEqual(result.profile.phases.map(phase => phase.valve), [1, 2, 2, 3]);
  assert.deepEqual(result.profile.phases.map(phase => phase.targets[0]?.curve), [
    'setup',
    'first',
    'first',
    'second',
  ]);
  assert.deepEqual(result.profile.phases.map(phase => phase.transition.adaptive), [
    true,
    false,
    false,
    true,
  ]);
});

test('normalizing duplicate marker times accumulates minimum spacing', () => {
  const markers = normalizeKeyframes([{ time: 0 }, { time: 0 }, { time: 0 }]);

  assert.deepEqual(markers.map(marker => marker.time), [0, 0.1, 0.2]);
});

test('numeric pump phases migrate to explicit pressure flow keyframes after edit', () => {
  const profile = {
    ...baseProfile,
    phases: [
      { ...baseProfile.phases[0], pump: 7 },
      { ...baseProfile.phases[1], pump: 6 },
    ],
  };

  const markers = profileToKeyframes(profile);
  const result = updateKeyframeSegment(profile, 0, { pressure: 8, flow: 3.5 });

  assert.equal(markers[0].pressure, 9);
  assert.equal(markers[0].flow, 4);
  assert.equal(markers[1].pressure, 9);
  assert.equal(markers[1].flow, 4);
  assert.deepEqual(result.profile.phases.map(phase => phase.pump), [
    { target: 'pressure', pressure: 9, flow: 4 },
    { target: 'pressure', pressure: 8, flow: 3.5 },
  ]);
});

test('keyframesToProfile clones metadata target arrays', () => {
  const markers = profileToKeyframes(baseProfile);
  const metadataTargets = [{ curve: 'shared' }];
  const profile = keyframesToProfile(baseProfile, markers, [
    baseProfile.phases[0],
    { ...baseProfile.phases[1], targets: metadataTargets },
  ]);

  assert.deepEqual(profile.phases[1].targets, metadataTargets);
  assert.notEqual(profile.phases[1].targets, metadataTargets);
});

test('removing a marker preserves metadata for surviving later segments', () => {
  const profile = {
    ...baseProfile,
    phases: [
      {
        ...baseProfile.phases[0],
        valve: 1,
        targets: [{ curve: 'setup' }],
        transition: { type: 'instant', duration: 0, adaptive: true },
      },
      {
        ...baseProfile.phases[1],
        name: 'A',
        valve: 2,
        duration: 4,
        targets: [{ curve: 'a' }],
        transition: { type: 'linear', duration: 4, adaptive: false },
      },
      {
        ...baseProfile.phases[1],
        name: 'B',
        valve: 3,
        duration: 6,
        targets: [{ curve: 'b' }],
        transition: { type: 'ease-out', duration: 6, adaptive: true },
      },
    ],
  };

  const result = removeKeyframeAtIndex(profile, 1);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 10]);
  assert.equal(result.profile.phases[1].name, 'B');
  assert.equal(result.profile.phases[1].valve, 3);
  assert.deepEqual(result.profile.phases[1].targets, [{ curve: 'b' }]);
  assert.equal(result.profile.phases[1].transition.adaptive, true);
});

test('standalone keyframe round trip preserves adaptive false transitions', () => {
  const profile = {
    ...baseProfile,
    phases: [
      baseProfile.phases[0],
      {
        ...baseProfile.phases[1],
        transition: { type: 'linear', duration: 10, adaptive: false },
      },
    ],
  };

  const roundTrip = keyframesToProfile(profile, profileToKeyframes(profile));

  assert.equal(roundTrip.phases[1].transition.type, 'linear');
  assert.equal(roundTrip.phases[1].transition.adaptive, false);
});

test('adding a marker to a legacy profile keeps synthesized metadata aligned', () => {
  const legacy = {
    ...baseProfile,
    phases: [
      {
        ...baseProfile.phases[1],
        name: 'Legacy A',
        valve: 2,
        duration: 8,
        targets: [{ curve: 'legacy-a' }],
        transition: { type: 'linear', duration: 8, adaptive: false },
      },
      {
        ...baseProfile.phases[1],
        name: 'Legacy B',
        valve: 3,
        duration: 12,
        targets: [{ curve: 'legacy-b' }],
        transition: { type: 'ease-in', duration: 12, adaptive: true },
      },
    ],
  };

  const result = addKeyframeAtTime(legacy, 3);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 3, 5, 12]);
  assert.deepEqual(result.profile.phases.map(phase => phase.valve), [2, 2, 2, 3]);
  assert.deepEqual(result.profile.phases.map(phase => phase.targets[0]?.curve), [
    'legacy-a',
    'legacy-a',
    'legacy-a',
    'legacy-b',
  ]);
  assert.deepEqual(result.profile.phases.map(phase => phase.transition.adaptive), [
    false,
    false,
    false,
    true,
  ]);
});

test('updating a segment applies metadata field patches to the runnable phase', () => {
  const result = updateKeyframeSegment(baseProfile, 0, {
    phase: 'water',
    valve: 0,
    targets: [{ curve: 'edited' }],
  });

  assert.equal(result.profile.phases[1].phase, 'water');
  assert.equal(result.profile.phases[1].valve, 0);
  assert.deepEqual(result.profile.phases[1].targets, [{ curve: 'edited' }]);
});

test('updates selected segment values through next marker semantics', () => {
  const result = updateKeyframeSegment(baseProfile, 0, {
    temperature: 91,
    pressure: 5.5,
    flow: 3,
    targetMode: 'pressure',
    rampType: 'ease-in-out',
  });

  assert.equal(result.profile.phases[1].temperature, 91);
  assert.equal(result.profile.phases[1].pump.pressure, 5.5);
  assert.equal(result.profile.phases[1].pump.flow, 3);
  assert.equal(result.profile.phases[1].transition.type, 'ease-in-out');
});

test('duration patch on setup-phase profile moves the correct marker', () => {
  const profile = {
    ...baseProfile,
    phases: [
      { ...baseProfile.phases[0], duration: 0 },
      { ...baseProfile.phases[1], duration: 5 },
      { ...baseProfile.phases[1], name: 'Phase 2', duration: 20 },
    ],
  };

  const result = updateKeyframeSegment(profile, 0, { duration: 7 });

  // Moving marker 1 from t=5 to t=7 sets phase 1 to 7s; phase 2 shrinks to 25-7=18s
  assert.deepEqual(result.profile.phases.map(p => p.duration), [0, 7, 18]);
});

test('duration patch on non-setup profile moves the correct marker via segmentIndex=index', () => {
  // Simulates what onPhaseChange does for a no-setup profile at form index 1:
  // hasInitialSetupPhase is false, so segmentIndex = index = 1
  const noSetupProfile = {
    ...baseProfile,
    phases: [
      { ...baseProfile.phases[1], name: 'Phase A', duration: 3 },
      { ...baseProfile.phases[1], name: 'Phase B', duration: 5 },
      { ...baseProfile.phases[1], name: 'Phase C', duration: 20 },
    ],
  };

  // segmentIndex = 1 (form index 1 for no-setup profile)
  const result = updateKeyframeSegment(noSetupProfile, 1, { duration: 7 });

  // Marker 2 moves from t=8 to t=10; Phase B becomes 7s, Phase C shrinks to 28-10=18s
  assert.deepEqual(result.profile.phases.map(p => p.duration), [0, 3, 7, 18]);
});
