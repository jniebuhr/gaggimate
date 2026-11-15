import { t } from '@lingui/core/macro';
import { getPhaseStats } from '../../services/analyzer/phaseAnalysis';
import {
  calculatePumpedWater,
  createPumpedWaterSource,
} from '../../services/analyzer/waterIntegration';
import { getFinalWeightSample, getFinalWeightSamples } from '../../services/analyzer/weightRate';

/** Split the post-stop tail for the table only; chart analysis and final weights stay intact. */
export function getAnalysisTableResults(results) {
  const phases = results?.phases || [];
  const samples = results?.rawSamples || [];
  const tailIndex = samples.findIndex(sample => sample.systemInfo?.extendedRecording);
  const lastPhase = phases.find(phase => phase.isFinalExecuted);
  if (tailIndex < 1 || !lastPhase) return results;

  const tailSamples = samples.slice(tailIndex);
  const start = (tailSamples[0].t - samples[0].t) / 1000;
  const end = (tailSamples.at(-1).t - samples[0].t) / 1000;
  if (end <= start) return results;

  const brewSamples = samples.slice(0, tailIndex);
  const activeSamples = brewSamples.filter(
    sample => String(sample.phaseNumber) === String(lastPhase.number),
  );
  if (activeSamples.length === 0) return results;

  const weightSamples = getFinalWeightSamples(samples).filter(
    sample => sample.t >= tailSamples[0].t,
  );
  if (weightSamples.length === 0) weightSamples.push(getFinalWeightSample(samples));
  const water = calculatePumpedWater(
    tailSamples,
    tailSamples.length - 1,
    null,
    createPumpedWaterSource(samples),
  );
  const analyzerSystemInfo = {
    brewModeLabel: results.brewModeLabel,
    configuredScaleDelayMs: results.configuredScaleDelayMs,
    recordedStopReason: lastPhase.stats.sys_recorded_stop_reason,
  };
  const activeStats = getPhaseStats(
    activeSamples,
    activeSamples,
    activeSamples.at(-1).systemInfo || {},
    lastPhase.stats.sys_anomalies || {},
    analyzerSystemInfo,
  );
  const tablePhases = phases.map(phase =>
    phase === lastPhase
      ? {
          ...phase,
          end: start,
          duration: Math.max(0, start - phase.start),
          water: Math.max(0, phase.water - water),
          weight: activeSamples.at(-1).v,
          useRecordedWeight: true,
          stats: activeStats,
        }
      : phase,
  );

  const brewStats = getPhaseStats(
    brewSamples,
    brewSamples,
    brewSamples.at(-1).systemInfo || {},
    {},
    analyzerSystemInfo,
  );

  return {
    ...results,
    total: {
      ...results.total,
      ...brewStats,
      duration: start,
      water: Math.max(0, results.total.water - water),
      weight: brewSamples.at(-1).v,
    },
    // Keep the accepted final weight; removing the cup must not lower it.
    extendedTotal: { ...results.total, duration: end },
    phases: [
      ...tablePhases,
      {
        number: 'extended-recording',
        displayName: t`Extended Record`,
        start,
        end,
        duration: end - start,
        water,
        weight: results.total.weight,
        stats: getPhaseStats(
          tailSamples,
          weightSamples,
          tailSamples.at(-1).systemInfo || {},
          {},
          {},
        ),
        exit: {},
      },
    ],
  };
}

export function getAnalysisTablePhases(results) {
  return getAnalysisTableResults(results)?.phases || [];
}
