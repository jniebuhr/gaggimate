import { t } from '@lingui/core/macro';
import { getProfilePhaseDisplayName } from './profilePhases.js';
import { PHASE_EXIT_REASON, getPhaseExitReasonMeta } from './exitReasons.js';
/** Inserts missing profile phases without discarding or reordering executed shot phases. */

import { createEmptyPhaseStats } from './metricStats.js';
import { formatStopReason, isTargetHit, isWeightTarget } from './targetMatching.js';

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
        reason: t`${formatStopReason(target.type)} (skipped)`,
        type: target.type,
        value: target.value,
      };
    }
  }
  return null;
}

function findNextExecutedFirstSample({ analyzedByIndex, phases, profileData, profileIndex }) {
  for (let index = profileIndex + 1; index < profileData.phases.length; index++) {
    const nextPhase = analyzedByIndex.get(index);
    if (!nextPhase) continue;

    const nextSamples = phases[nextPhase.number];
    return Array.isArray(nextSamples) ? nextSamples[0] || null : null;
  }
  return null;
}

function getSkippedPhaseFallbackInfo() {
  return {
    reason: 'Phase skipped',
    type: 'unknown',
    value: null,
  };
}

function getSkippedPhaseInfo({
  analyzedByIndex,
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
    analyzedByIndex,
    phases,
    profileData,
    profileIndex,
  });
  const nextMatch = firstSample
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getFirstSampleTargetValue(target, firstSample),
      )
    : null;

  return nextMatch || getSkippedPhaseFallbackInfo();
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
    ratio: 'ratio',
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

function createSkippedPhase(profilePhase, profileIndex, skipInfo, profileData, notReached = false) {
  return {
    number: profileIndex,
    profilePhaseIndex: profileIndex,
    notReached,
    name: profilePhase.name,
    displayName: getProfilePhaseDisplayName(profileData, profileIndex, profilePhase.name),
    start: 0,
    end: 0,
    duration: 0,
    water: 0,
    weight: 0,
    stats: createEmptyPhaseStats(),
    exit: {
      code: skipInfo.code || 0,
      reason: skipInfo.reason,
      source: skipInfo.source || 'inferred',
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
    isFinalExecuted: false,
    skipped: true,
  };
}

function appendSkippedProfilePhases({
  analyzedByIndex,
  endIndex,
  orderedPhases,
  phases,
  prevPhase,
  profileData,
  startIndex,
  notReached = false,
  recordedExitReasonByPhase,
}) {
  for (let profileIndex = startIndex; profileIndex < endIndex; profileIndex++) {
    const profilePhase = profileData.phases[profileIndex];
    if (!normalizePhaseLookupName(profilePhase.name)) continue;

    let skipInfo = notReached
      ? { reason: 'Phase not reached', type: 'unknown', value: null }
      : getSkippedPhaseInfo({
          analyzedByIndex,
          phases,
          prevPhase,
          profileData,
          profileIndex,
          profilePhase,
        });
    const recorded = getPhaseExitReasonMeta(recordedExitReasonByPhase?.get(String(profileIndex)));
    if (!notReached && recorded.exitType) {
      const sameTargetType =
        skipInfo.type === recorded.exitType ||
        (isWeightTarget({ type: skipInfo.type }) && isWeightTarget({ type: recorded.exitType }));
      skipInfo = {
        code: recordedExitReasonByPhase.get(String(profileIndex)),
        source: 'recorded',
        reason: `${recorded.stopReason} (skipped)`,
        type: recorded.exitType,
        value: sameTargetType ? skipInfo.value : null,
      };
    }
    orderedPhases.push(
      createSkippedPhase(profilePhase, profileIndex, skipInfo, profileData, notReached),
    );
  }
}

export function mergeSkippedProfilePhases({
  analyzedPhases,
  phases,
  profileData,
  finalExitReasonCode,
  recordedExitReasonByPhase,
}) {
  if (!profileData?.phases?.length) return;

  const executedPhases = [...analyzedPhases];
  // An ambiguous profile match cannot prove which profile phases are absent.
  if (executedPhases.some(phase => phase.profilePhaseIndex == null)) return;
  // A legacy name fallback may use a different numbering scheme.
  const recordedProfileReasons = executedPhases.every(
    phase => Number(phase.number) === phase.profilePhaseIndex,
  )
    ? recordedExitReasonByPhase
    : null;
  const analyzedByIndex = new Map(executedPhases.map(phase => [phase.profilePhaseIndex, phase]));
  const orderedPhases = [];
  let profileIndex = 0;
  let previousExecutedPhase = null;

  for (const executedPhase of executedPhases) {
    const matchingProfileIndex = executedPhase.profilePhaseIndex;

    if (matchingProfileIndex >= 0) {
      appendSkippedProfilePhases({
        recordedExitReasonByPhase: recordedProfileReasons,
        analyzedByIndex,
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
    recordedExitReasonByPhase: recordedProfileReasons,
    analyzedByIndex,
    notReached: [
      PHASE_EXIT_REASON.ABORTED,
      PHASE_EXIT_REASON.SAFETY,
      PHASE_EXIT_REASON.HOLD_RELEASED,
    ].includes(finalExitReasonCode),
    endIndex: profileData.phases.length,
    orderedPhases,
    phases,
    prevPhase: previousExecutedPhase,
    profileData,
    startIndex: profileIndex,
  });

  // Legacy numbering may overlap synthetic profile indices; chart keys stay unique.
  const usedNumbers = new Set(executedPhases.map(phase => String(phase.number)));
  for (const phase of orderedPhases) {
    if (!phase.skipped) continue;
    if (usedNumbers.has(String(phase.number))) phase.number = -(phase.profilePhaseIndex + 1);
    usedNumbers.add(String(phase.number));
  }
  analyzedPhases.length = 0;
  analyzedPhases.push(...orderedPhases);
}
