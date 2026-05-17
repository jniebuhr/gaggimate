import { buildProfile } from './buildProfile.js';

function makeSegment(overrides = {}) {
  return {
    name: 'Phase 1',
    startIdx: 0,
    endIdx: 10,
    durationSeconds: 10,
    targetType: 'pressure',
    targetValue: 6,
    temperature: 93,
    ...overrides,
  };
}

describe('buildProfile', () => {
  it('throws when segments array is empty', () => {
    expect(() => buildProfile('Test', [])).toThrow();
  });

  it('throws when segments is null/undefined', () => {
    expect(() => buildProfile('Test', null)).toThrow();
  });

  it('produces a profile with the given label', () => {
    const profile = buildProfile('My Profile', [makeSegment()]);
    expect(profile.label).toBe('My Profile');
  });

  it('generates a unique uuid id', () => {
    const a = buildProfile('A', [makeSegment()]);
    const b = buildProfile('B', [makeSegment()]);
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('sets type to "pro"', () => {
    const profile = buildProfile('Test', [makeSegment()]);
    expect(profile.type).toBe('pro');
  });

  it('sets top-level temperature from first segment', () => {
    const profile = buildProfile('Test', [makeSegment({ temperature: 94.6 })]);
    expect(profile.temperature).toBe(95); // rounded
  });

  it('emits 0 (not -1) for inactive flow limit on pressure segments', () => {
    const profile = buildProfile('Test', [makeSegment({ targetType: 'pressure', targetValue: 6 })]);
    expect(profile.phases[0].pump.flow).toBe(0);
    expect(profile.phases[0].pump.pressure).toBe(6);
  });

  it('emits 0 (not -1) for inactive pressure limit on flow segments', () => {
    const profile = buildProfile('Test', [makeSegment({ targetType: 'flow', targetValue: 3 })]);
    expect(profile.phases[0].pump.pressure).toBe(0);
    expect(profile.phases[0].pump.flow).toBe(3);
  });

  it('emits one phase per segment', () => {
    const segs = [makeSegment({ name: 'P1' }), makeSegment({ name: 'P2', targetType: 'flow', targetValue: 2 })];
    const profile = buildProfile('Test', segs);
    expect(profile.phases).toHaveLength(2);
    expect(profile.phases[0].name).toBe('P1');
    expect(profile.phases[1].name).toBe('P2');
  });

  it('uses instant transition with adaptive:false by default', () => {
    const profile = buildProfile('Test', [makeSegment()]);
    expect(profile.phases[0].transition).toEqual({ type: 'instant', duration: 0, adaptive: false });
  });

  it('rounds per-phase temperature', () => {
    const profile = buildProfile('Test', [makeSegment({ temperature: 92.4 })]);
    expect(profile.phases[0].temperature).toBe(92);
  });

  it('handles multiple segments with mixed modes', () => {
    const segs = [
      makeSegment({ targetType: 'pressure', targetValue: 9 }),
      makeSegment({ targetType: 'flow', targetValue: 2.5 }),
    ];
    const profile = buildProfile('Test', segs);
    expect(profile.phases[0].pump).toEqual({ target: 'pressure', pressure: 9, flow: 0 });
    expect(profile.phases[1].pump).toEqual({ target: 'flow', pressure: 0, flow: 2.5 });
  });
});
