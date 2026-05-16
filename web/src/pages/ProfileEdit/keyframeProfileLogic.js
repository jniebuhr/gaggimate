export const MIN_PHASE_DURATION = 0.1;

const DEFAULT_MARKER = {
  temperature: 0,
  pressure: 9,
  flow: 4,
  targetMode: 'pressure',
  rampType: 'instant',
};

function toNumber(value, fallback = 0) {
  const next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : fallback;
}

function isPumpObject(pump) {
  return pump && typeof pump === 'object';
}

function readPump(pump, fallback = DEFAULT_MARKER) {
  if (!isPumpObject(pump)) {
    return {
      pressure: fallback.pressure,
      flow: fallback.flow,
      targetMode: fallback.targetMode,
    };
  }

  return {
    pressure: toNumber(pump.pressure, fallback.pressure),
    flow: toNumber(pump.flow, fallback.flow),
    targetMode: pump.target === 'flow' ? 'flow' : 'pressure',
  };
}

function makePump(marker) {
  return {
    target: marker.targetMode === 'flow' ? 'flow' : 'pressure',
    pressure: toNumber(marker.pressure, DEFAULT_MARKER.pressure),
    flow: toNumber(marker.flow, DEFAULT_MARKER.flow),
  };
}

function compactPatch(patch) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function cloneTargets(targets) {
  return Array.isArray(targets) ? [...targets] : [];
}

function hasInitialSetupPhase(phases) {
  return toNumber(phases[0]?.duration, MIN_PHASE_DURATION) === 0;
}

function getMarkerAlignedMetadata(profile) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];
  if (phases.length === 0) {
    return [];
  }

  return hasInitialSetupPhase(phases) ? [...phases] : [phases[0], ...phases];
}

function applyMetadataPatch(metadata, patch) {
  const next = { ...metadata };

  if (patch.phase !== undefined) {
    next.phase = patch.phase;
  }

  if (patch.valve !== undefined) {
    next.valve = patch.valve;
  }

  if (patch.targets !== undefined) {
    next.targets = cloneTargets(patch.targets);
  }

  return next;
}

function phaseToMarker(phase, time, fallback = DEFAULT_MARKER, index = 0) {
  const pump = readPump(phase?.pump, fallback);

  return {
    time,
    name: phase?.name || (index === 0 ? 'Start' : `Phase ${index}`),
    temperature: toNumber(phase?.temperature, 0),
    pressure: pump.pressure,
    flow: pump.flow,
    targetMode: pump.targetMode,
    rampType: phase?.transition?.type || 'instant',
    rampDuration: toNumber(phase?.transition?.duration, 0),
    adaptive: phase?.transition?.adaptive ?? true,
    phase: phase?.phase || 'brew',
    valve: phase?.valve ?? 1,
    targets: cloneTargets(phase?.targets),
  };
}

export function profileToKeyframes(profile) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];

  if (phases.length === 0) {
    return [
      { ...DEFAULT_MARKER, time: 0, name: 'Start' },
      { ...DEFAULT_MARKER, time: 10, name: 'Phase 1' },
    ];
  }

  const hasSetupPhase = hasInitialSetupPhase(phases);
  const markers = [];
  let time = 0;

  if (hasSetupPhase) {
    markers.push(phaseToMarker(phases[0], 0, DEFAULT_MARKER, 0));
    for (let index = 1; index < phases.length; index++) {
      time += Math.max(MIN_PHASE_DURATION, toNumber(phases[index].duration, MIN_PHASE_DURATION));
      markers.push(phaseToMarker(phases[index], time, readPump(phases[index - 1].pump), index));
    }
  } else {
    markers.push(phaseToMarker(phases[0], 0, DEFAULT_MARKER, 0));
    for (let index = 0; index < phases.length; index++) {
      time += Math.max(MIN_PHASE_DURATION, toNumber(phases[index].duration, MIN_PHASE_DURATION));
      markers.push(
        phaseToMarker(
          phases[index],
          time,
          index > 0 ? readPump(phases[index - 1].pump) : readPump(phases[0].pump),
          index + 1,
        ),
      );
    }
  }

  if (markers.length === 1) {
    markers.push({ ...markers[0], time: markers[0].time + 10, name: 'Phase 1' });
  }

  markers[0] = { ...markers[0], time: 0, rampType: 'instant', rampDuration: 0 };
  return markers;
}

export function keyframesToProfile(profile, markers, segmentMetadata = []) {
  const sorted = normalizeKeyframes(markers);
  const phases = sorted.map((marker, index) => {
    const nextTime = sorted[index]?.time ?? 0;
    const prevTime = index === 0 ? 0 : sorted[index - 1].time;
    const duration = index === 0 ? 0 : Math.max(MIN_PHASE_DURATION, nextTime - prevTime);
    const metadata = segmentMetadata[index] || {};
    const rampType = index === 0 ? 'instant' : marker.rampType || 'instant';

    return {
      name: marker.name || (index === 0 ? 'Start' : `Phase ${index}`),
      phase: metadata.phase || marker.phase || (index === 0 ? 'preinfusion' : 'brew'),
      valve: metadata.valve ?? marker.valve ?? 1,
      pump: makePump(marker),
      duration,
      transition: {
        type: rampType,
        duration: rampType === 'instant' ? 0 : duration,
        adaptive: metadata.transition?.adaptive ?? marker.adaptive ?? true,
      },
      targets: Array.isArray(metadata.targets)
        ? cloneTargets(metadata.targets)
        : Array.isArray(marker.targets)
          ? cloneTargets(marker.targets)
          : [],
      temperature: toNumber(marker.temperature, 0),
    };
  });

  return {
    ...profile,
    type: 'pro',
    phases,
  };
}

export function normalizeKeyframes(markers) {
  const sorted = [...markers].sort((a, b) => toNumber(a.time, 0) - toNumber(b.time, 0));
  const normalized = [];

  for (const [index, marker] of sorted.entries()) {
    const previousTime = index === 0 ? 0 : normalized[index - 1].time;
    const minTime = index === 0 ? 0 : previousTime + MIN_PHASE_DURATION;

    normalized.push({
      ...DEFAULT_MARKER,
      ...marker,
      time: index === 0 ? 0 : Math.max(minTime, toNumber(marker.time, minTime)),
    });
  }

  return normalized;
}

export function addKeyframeAtTime(profile, time) {
  const markers = profileToKeyframes(profile);
  const clampedTime = Math.max(MIN_PHASE_DURATION, toNumber(time, MIN_PHASE_DURATION));
  let insertAfter = 0;

  for (let index = 0; index < markers.length; index++) {
    if (markers[index].time < clampedTime) insertAfter = index;
  }

  const source = markers[Math.min(insertAfter + 1, markers.length - 1)] || markers[markers.length - 1];
  const insertionToken = {};
  const nextMarkers = normalizeKeyframes([
    ...markers,
    { ...source, time: clampedTime, name: `Phase ${markers.length}`, __insertionToken: insertionToken },
  ]);
  const insertedIndex = nextMarkers.findIndex(marker => marker.__insertionToken === insertionToken);
  const alignedMetadata = getMarkerAlignedMetadata(profile);
  const sourceMetadataIndex = Math.min(insertAfter + 1, alignedMetadata.length - 1);
  const nextMetadata = [...alignedMetadata];

  if (insertedIndex >= 0 && nextMetadata.length > 0) {
    nextMetadata.splice(
      insertedIndex,
      0,
      nextMetadata[sourceMetadataIndex] || nextMetadata[nextMetadata.length - 1],
    );
  }

  return {
    profile: keyframesToProfile(profile, nextMarkers, nextMetadata),
    selectedSegmentIndex: Math.max(0, insertedIndex),
  };
}

export function moveKeyframeTime(profile, markerIndex, time) {
  const markers = profileToKeyframes(profile);

  if (markerIndex <= 0 || markerIndex >= markers.length) {
    return { profile, selectedSegmentIndex: Math.max(0, markerIndex - 1) };
  }

  const previous = markers[markerIndex - 1].time + MIN_PHASE_DURATION;
  const next = markers[markerIndex + 1]?.time - MIN_PHASE_DURATION;
  const maxTime = Number.isFinite(next) ? next : Number.POSITIVE_INFINITY;
  const clamped = Math.min(maxTime, Math.max(previous, toNumber(time, previous)));
  const nextMarkers = markers.map((marker, index) =>
    index === markerIndex ? { ...marker, time: clamped } : marker,
  );

  return {
    profile: keyframesToProfile(profile, nextMarkers, getMarkerAlignedMetadata(profile)),
    selectedSegmentIndex: markerIndex - 1,
  };
}

export function removeKeyframeAtIndex(profile, markerIndex) {
  const markers = profileToKeyframes(profile);

  if (markers.length <= 2 || markerIndex <= 0 || markerIndex >= markers.length) {
    return { profile, selectedSegmentIndex: 0 };
  }

  const nextMarkers = markers.filter((_, index) => index !== markerIndex);
  const nextMetadata = getMarkerAlignedMetadata(profile).filter((_, index) => index !== markerIndex);

  return {
    profile: keyframesToProfile(profile, nextMarkers, nextMetadata),
    selectedSegmentIndex: Math.max(0, markerIndex - 1),
  };
}

export function updateKeyframeSegment(profile, segmentIndex, patch) {
  const markers = profileToKeyframes(profile);
  const markerIndex = Math.min(markers.length - 1, Math.max(1, segmentIndex + 1));
  const nextMarkers = markers.map((marker, index) =>
    index === markerIndex ? { ...marker, ...compactPatch(patch) } : marker,
  );
  const nextMetadata = getMarkerAlignedMetadata(profile);

  if (nextMetadata[markerIndex]) {
    nextMetadata[markerIndex] = applyMetadataPatch(nextMetadata[markerIndex], patch);
  }

  return {
    profile: keyframesToProfile(profile, nextMarkers, nextMetadata),
    selectedSegmentIndex: segmentIndex,
  };
}
