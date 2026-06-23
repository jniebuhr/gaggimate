import { createEmptyPhaseStats } from './metricStats';
import { formatStopReason, isTargetHit, isWeightTarget } from './targetMatching';

function normalizePhaseLookupName(name) {
  return (name || '').trim().toLowerCase();
}

function getPreviousPhaseTargetValue(target, prevPhase) {
  if (isWeightTarget(target)) return prevPhase.weight ?? 0;
  if (target.type === 'pumped') return prevPhase.water ?? 0;
  if (target.type === 'pressure') return prevPhase.stats?.p?.avg ?? 0;
  if (target.type === 'flow') return prevPhase.stats?.f?.avg ?? 0;
  return undefined;
}

function getFirstSampleTargetValue(target, firstSample) {
  if (isWeightTarget(target)) return firstSample.v ?? 0;
  if (target.type === 'pressure') return firstSample.cp ?? 0;
  if (target.type === 'flow') return firstSample.fl ?? 0;
  return undefined;
}

function findSkippedTargetMatch(targets, getCurrentValue) {
  if (!Array.isArray(targets)) return null;

  for (const target of targets) {
    const currentValue = getCurrentValue(target);
    if (currentValue === undefined) continue;

    if (isTargetHit(target, currentValue, { isLastPhase: false })) {
      return {
        reason: `${formatStopReason(target.type)} (skipped)`,
        type: target.type,
        value: target.value,
      };
    }
  }
  return null;
}

function findNextExecutedFirstSample({ analyzedByName, phases, profileData, profileIndex }) {
  for (let index = profileIndex + 1; index < profileData.phases.length; index++) {
    const nextName = normalizePhaseLookupName(profileData.phases[index].name);
    const nextPhase = analyzedByName.get(nextName);
    if (!nextPhase) continue;

    const nextSamples = phases[nextPhase.number];
    return Array.isArray(nextSamples) ? nextSamples[0] || null : null;
  }
  return null;
}

function getSkippedPhaseFallbackInfo(prevPhase) {
  return {
    reason: prevPhase ? 'Phase skipped' : 'Phase skipped (no preceding phase)',
    type: 'unknown',
    value: null,
  };
}

function getSkippedPhaseInfo({
  analyzedByName,
  phases,
  prevPhase,
  profileData,
  profileIndex,
  profilePhase,
}) {
  const previousMatch = prevPhase
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getPreviousPhaseTargetValue(target, prevPhase),
      )
    : null;
  if (previousMatch) return previousMatch;

  const firstSample = findNextExecutedFirstSample({
    analyzedByName,
    phases,
    profileData,
    profileIndex,
  });
  const nextMatch = firstSample
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getFirstSampleTargetValue(target, firstSample),
      )
    : null;

  return nextMatch || getSkippedPhaseFallbackInfo(prevPhase);
}

function buildSkippedTargetCalcValues(skipType, skipValue) {
  if (!skipType || skipValue == null) return null;

  const calcValueByType = {
    duration: 'duration',
    flow: 'flow',
    pressure: 'pressure',
    pumped: 'pumped',
    volumetric: 'weight',
    weight: 'weight',
  };
  const calcKey = calcValueByType[skipType];
  if (!calcKey) return null;

  return {
    [calcKey]: {
      value: skipValue,
      isStopReason: true,
    },
  };
}

function createSkippedPhase(profilePhase, profileIndex, skipInfo) {
  return {
    number: profileIndex,
    name: profilePhase.name,
    displayName: profilePhase.name,
    start: 0,
    end: 0,
    duration: 0,
    water: 0,
    weight: 0,
    stats: createEmptyPhaseStats(),
    exit: {
      reason: skipInfo.reason,
      type: skipInfo.type || 'unknown',
    },
    profilePhase,
    scaleLost: false,
    scalePermanentlyLost: false,
    highScaleDelay: false,
    estimatedScaleDelayMs: null,
    delayReviewHint: false,
    delayReviewReason: null,
    delayReviewMs: null,
    prediction: { finalWeight: null },
    targetCalcValues: buildSkippedTargetCalcValues(skipInfo.type, skipInfo.value),
    skipped: true,
  };
}

function buildAnalyzedPhaseLookup(analyzedPhases) {
  const analyzedByName = new Map();

  for (const phase of analyzedPhases) {
    const key = normalizePhaseLookupName(phase.displayName || phase.name);
    if (key) analyzedByName.set(key, phase);
  }

  return analyzedByName;
}

function findMatchingProfilePhaseIndex(profilePhases, phase, startIndex) {
  const phaseName = normalizePhaseLookupName(phase.displayName || phase.name);
  if (!phaseName) return -1;

  return profilePhases.findIndex(
    (profilePhase, profileIndex) =>
      profileIndex >= startIndex && normalizePhaseLookupName(profilePhase.name) === phaseName,
  );
}

function appendSkippedProfilePhases({
  analyzedByName,
  endIndex,
  orderedPhases,
  phases,
  prevPhase,
  profileData,
  startIndex,
}) {
  for (let profileIndex = startIndex; profileIndex < endIndex; profileIndex++) {
    const profilePhase = profileData.phases[profileIndex];
    if (!normalizePhaseLookupName(profilePhase.name)) continue;

    const skipInfo = getSkippedPhaseInfo({
      analyzedByName,
      phases,
      prevPhase,
      profileData,
      profileIndex,
      profilePhase,
    });
    orderedPhases.push(createSkippedPhase(profilePhase, profileIndex, skipInfo));
  }
}

export function mergeSkippedProfilePhases({ analyzedPhases, phases, profileData }) {
  if (!profileData?.phases?.length) return;

  const executedPhases = [...analyzedPhases];
  const analyzedByName = buildAnalyzedPhaseLookup(executedPhases);
  const orderedPhases = [];
  let profileIndex = 0;
  let previousExecutedPhase = null;

  for (const executedPhase of executedPhases) {
    const matchingProfileIndex = findMatchingProfilePhaseIndex(
      profileData.phases,
      executedPhase,
      profileIndex,
    );

    if (matchingProfileIndex >= 0) {
      appendSkippedProfilePhases({
        analyzedByName,
        endIndex: matchingProfileIndex,
        orderedPhases,
        phases,
        prevPhase: previousExecutedPhase,
        profileData,
        startIndex: profileIndex,
      });
      profileIndex = matchingProfileIndex + 1;
    }

    orderedPhases.push(executedPhase);
    previousExecutedPhase = executedPhase;
  }

  appendSkippedProfilePhases({
    analyzedByName,
    endIndex: profileData.phases.length,
    orderedPhases,
    phases,
    prevPhase: previousExecutedPhase,
    profileData,
    startIndex: profileIndex,
  });

  analyzedPhases.length = 0;
  analyzedPhases.push(...orderedPhases);
}
