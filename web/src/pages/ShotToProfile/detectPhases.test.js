import { detectPhases, MAX_BOUNDARIES } from './detectPhases.js';

// Build a flat array of sample objects with a single signal field.
function makeSamples(values, field = 'cp') {
  return values.map(v => ({ [field]: v, t: 0 }));
}

// Build a ramp: lo → hi over `count` samples.
function ramp(lo, hi, count) {
  return Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
}

describe('detectPhases', () => {
  it('returns [] for fewer than SMOOTH_WINDOW*2 samples', () => {
    expect(detectPhases(makeSamples([1, 2, 3]))).toEqual([]);
  });

  it('returns [] for a flat (monotone) signal with no sign change', () => {
    const samples = makeSamples(Array(40).fill(7));
    expect(detectPhases(samples)).toEqual([]);
  });

  it('returns [] for a monotone rising ramp (no sign change)', () => {
    const samples = makeSamples(ramp(0, 10, 40));
    expect(detectPhases(samples)).toEqual([]);
  });

  it('detects one boundary for a rise-then-plateau signal', () => {
    // Rising for 20 samples, then flat — creates one sustained sign change
    const values = [...ramp(0, 9, 20), ...Array(30).fill(9)];
    const samples = makeSamples(values);
    const result = detectPhases(samples);
    expect(result.length).toBe(1);
    // Boundary should be somewhere in the middle, not at the very start or end
    expect(result[0]).toBeGreaterThan(0);
    expect(result[0]).toBeLessThan(samples.length - 1);
  });

  it('detects boundary in a flow-targeted shot when isFlowTargeted=true', () => {
    const values = [...ramp(0, 5, 20), ...Array(30).fill(5)];
    const samples = values.map(v => ({ fl: v, cp: 9, t: 0 }));
    const result = detectPhases(samples, true);
    expect(result.length).toBe(1);
  });

  it('caps at MAX_BOUNDARIES even when many sign changes exist', () => {
    // Alternating ramps produce many boundaries
    const segment = [...ramp(0, 5, 10), ...ramp(5, 0, 10)];
    const values = Array(4).fill(segment).flat();
    const samples = makeSamples(values);
    const result = detectPhases(samples);
    expect(result.length).toBeLessThanOrEqual(MAX_BOUNDARIES);
  });

  it('returns sorted indices', () => {
    const values = [...ramp(0, 9, 20), ...Array(20).fill(9), ...ramp(9, 3, 20), ...Array(20).fill(3)];
    const samples = makeSamples(values);
    const result = detectPhases(samples);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThan(result[i - 1]);
    }
  });

  it('detects two boundaries for a rise-plateau-fall signal', () => {
    // Plateau must be wide enough (>= MIN_GAP + 2*SMOOTH_WINDOW ≈ 36 samples) so the
    // ramp-to-hold boundary and the hold-to-fall boundary are far enough apart to survive
    // the MIN_GAP merge step.
    const values = [...ramp(0, 9, 25), ...Array(40).fill(9), ...ramp(9, 2, 25)];
    const samples = makeSamples(values);
    const result = detectPhases(samples);
    expect(result.length).toBe(2);
    // First boundary: plateau entry (in the first half of the signal)
    expect(result[0]).toBeGreaterThan(5);
    expect(result[0]).toBeLessThan(samples.length / 2);
    // Second boundary: fall entry (in the second half)
    expect(result[1]).toBeGreaterThan(samples.length / 2);
    expect(result[1]).toBeLessThan(samples.length - 5);
  });

  it('returns [] for a monotone rising ramp with no plateau (no spurious boundary)', () => {
    // Strictly monotone — no plateau, no descent — should produce no boundary
    const samples = makeSamples([...ramp(0, 10, 50)]);
    expect(detectPhases(samples)).toEqual([]);
  });

  it('merges boundaries closer than MIN_GAP (~5 s)', () => {
    // Two very close sign changes should merge into one boundary
    const values = [
      ...ramp(0, 9, 5),
      ...ramp(9, 8, 5),  // tiny dip — close sign change
      ...Array(40).fill(8),
    ];
    const samples = makeSamples(values);
    const result = detectPhases(samples);
    // Should be at most 1 boundary (close ones merged)
    expect(result.length).toBeLessThanOrEqual(1);
  });
});
