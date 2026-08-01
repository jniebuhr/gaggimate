/**
 * StatisticsService.js
 * Pure aggregation logic for multi-shot statistics.
 * No side effects, no state — just computation.
 *
 * Input: Array of { analysis, meta: { id, timestamp, profileName, source } }
 * Output: StatisticsResult object
 */

function averageOf(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

// Population standard deviation (not sample): we treat the loaded shots as the full
// dataset, not a sample drawn from a larger population.
function stdDevOf(values, mean) {
  if (values.length < 2) return 0;
  let sumSq = 0;
  for (const value of values) {
    const d = value - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / values.length);
}

function aggregateMetricStats(totals, key) {
  const avgs = [];
  const mins = [];
  const maxs = [];

  for (const t of totals) {
    const stat = t[key];
    if (!stat) continue;
    if (Number.isFinite(stat.avg)) avgs.push(stat.avg);
    if (Number.isFinite(stat.min)) mins.push(stat.min);
    if (Number.isFinite(stat.max)) maxs.push(stat.max);
  }

  const avg = averageOf(avgs);
  return {
    avg,
    min: mins.length ? Math.min(...mins) : 0,
    max: maxs.length ? Math.max(...maxs) : 0,
    stdDev: stdDevOf(avgs, avg),
  };
}

function aggregateValueStats(values) {
  const finiteValues = values.filter(Number.isFinite);
  const avg = averageOf(finiteValues);
  return {
    avg,
    min: finiteValues.length ? Math.min(...finiteValues) : 0,
    max: finiteValues.length ? Math.max(...finiteValues) : 0,
    stdDev: stdDevOf(finiteValues, avg),
  };
}

function getTotalTempTargetDeviation(total) {
  const actualAvg = Number(total?.t?.avg);
  const targetAvg = Number(total?.tt?.avg);
  if (!Number.isFinite(actualAvg) || !Number.isFinite(targetAvg)) return null;
  return Math.abs(actualAvg - targetAvg);
}

function createSummaryAccumulator() {
  return {
    totalDuration: 0,
    totalWater: 0,
    totalWeight: 0,
    earliest: Infinity,
    latest: -Infinity,
    gmCount: 0,
    browserCount: 0,
    tempAvgs: [],
    tempTargetDeviations: [],
  };
}

function addTotalSummaryValues(acc, total) {
  if (!total) return;
  if (Number.isFinite(total.duration)) acc.totalDuration += total.duration;
  if (Number.isFinite(total.water)) acc.totalWater += total.water;
  if (Number.isFinite(total.weight)) acc.totalWeight += total.weight;
  if (Number.isFinite(total.t?.avg)) acc.tempAvgs.push(total.t.avg);
  const tempTargetDeviation = getTotalTempTargetDeviation(total);
  if (Number.isFinite(tempTargetDeviation)) acc.tempTargetDeviations.push(tempTargetDeviation);
}

function addMetaSummaryValues(acc, meta) {
  if (Number.isFinite(meta.timestamp)) {
    acc.earliest = Math.min(acc.earliest, meta.timestamp);
    acc.latest = Math.max(acc.latest, meta.timestamp);
  }
  if (meta.source === 'gaggimate') acc.gmCount += 1;
  else acc.browserCount += 1;
}

function computeSummary(entries) {
  const totalShots = entries.length;
  const acc = createSummaryAccumulator();

  for (const { analysis, meta } of entries) {
    addTotalSummaryValues(acc, analysis.total);
    addMetaSummaryValues(acc, meta);
  }

  const avgTemp = averageOf(acc.tempAvgs);
  const avgTempTargetDeviation = averageOf(acc.tempTargetDeviations);

  return {
    totalShots,
    totalDuration: acc.totalDuration,
    totalWater: acc.totalWater,
    totalWeight: acc.totalWeight,
    avgDuration: totalShots ? acc.totalDuration / totalShots : 0,
    avgWater: totalShots ? acc.totalWater / totalShots : 0,
    avgWeight: totalShots ? acc.totalWeight / totalShots : 0,
    avgTemp,
    avgTempTargetDeviation,
    dateRange: {
      earliest: acc.earliest === Infinity ? null : acc.earliest,
      latest: acc.latest === -Infinity ? null : acc.latest,
    },
    sourceBreakdown: { gaggimate: acc.gmCount, browser: acc.browserCount },
  };
}

function computeMetricAverages(entries) {
  const totals = entries.map(e => e.analysis.total).filter(Boolean);
  const keys = ['p', 'f', 'pf', 'tt', 't', 'w'];
  const metrics = {};
  for (const key of keys) {
    metrics[key] =
      key === 'w'
        ? aggregateValueStats(totals.map(total => total.weight))
        : aggregateMetricStats(totals, key);
  }
  metrics.water = aggregateValueStats(totals.map(total => total.water));
  metrics.duration = aggregateValueStats(totals.map(total => total.duration));
  metrics.ttDelta = aggregateValueStats(totals.map(getTotalTempTargetDeviation));
  metrics.pPeak = aggregateValueStats(totals.map(total => total.p?.max));
  return metrics;
}

function computeProfileGroups(entries) {
  const groups = new Map();

  for (const entry of entries) {
    const name = entry.meta.profileName || '(Unmatched)';
    if (!groups.has(name)) {
      groups.set(name, []);
    }
    groups.get(name).push(entry);
  }

  const result = [];
  for (const [profileName, groupEntries] of groups) {
    const totals = groupEntries.map(e => e.analysis.total).filter(Boolean);
    const durations = totals.map(t => t.duration).filter(Number.isFinite);
    const weights = totals.map(t => t.weight).filter(Number.isFinite);
    const waters = totals.map(t => t.water).filter(Number.isFinite);

    const keys = ['p', 'f', 'pf', 't', 'w'];
    const metrics = {};
    for (const key of keys) {
      metrics[key] =
        key === 'w'
          ? aggregateValueStats(totals.map(total => total.weight))
          : aggregateMetricStats(totals, key);
    }

    result.push({
      profileName,
      shotCount: groupEntries.length,
      avgDuration: averageOf(durations),
      avgWeight: averageOf(weights),
      avgWater: averageOf(waters),
      metrics,
    });
  }

  result.sort((a, b) => b.shotCount - a.shotCount);
  return result;
}

/**
 * For a group of same-name phases across shots, compute the average
 * deviation from profile targets (duration, water/pumped, pressure, flow, weight, temp).
 * Uses the measured values from the analyzed shot.
 */
function computePhaseTargetDeltas(phases) {
  const keys = ['duration', 'water', 'p', 'f', 't', 'w'];
  const actuals = {};
  const targets = {};
  for (const k of keys) {
    actuals[k] = [];
    targets[k] = [];
  }

  for (const phase of phases) {
    addPhaseTargetDeltaValues({ phase, actuals, targets });
  }

  const result = {};
  for (const key of keys) {
    if (actuals[key].length > 0) {
      const avgActual = averageOf(actuals[key]);
      const avgTarget = averageOf(targets[key]);
      result[key] = { actual: avgActual, target: avgTarget, delta: avgActual - avgTarget };
    }
  }
  return result;
}

function pushTargetDeltaValues({ actuals, targets, key, actual, target }) {
  if (!Number.isFinite(actual) || !Number.isFinite(target)) return;
  actuals[key].push(actual);
  targets[key].push(target);
}

function findPhaseTarget(phase, predicate) {
  const targets = Array.isArray(phase?.profilePhase?.targets) ? phase.profilePhase.targets : [];
  return targets.find(predicate);
}

function addDurationTargetDelta({ phase, actuals, targets }) {
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 'duration',
    actual: phase.duration,
    target: phase.profilePhase?.duration,
  });
}

function addPumpedTargetDelta({ phase, actuals, targets }) {
  const pumpedTarget = findPhaseTarget(phase, target => target.type === 'pumped');
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 'water',
    actual: phase.water,
    target: pumpedTarget?.value,
  });
}

function addWeightTargetDelta({ phase, actuals, targets }) {
  const weightTarget = findPhaseTarget(
    phase,
    target => target.type === 'weight' || target.type === 'volumetric',
  );
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 'w',
    actual: phase.prediction?.finalWeight ?? phase.weight,
    target: weightTarget?.value,
  });
}

function addMetricTargetDelta({ phase, actuals, targets, key, targetType }) {
  const target = findPhaseTarget(phase, candidate => candidate.type === targetType);
  pushTargetDeltaValues({
    actuals,
    targets,
    key,
    actual: phase.stats?.[key]?.avg,
    target: target?.value,
  });
}

function addTemperatureTargetDelta({ phase, actuals, targets }) {
  pushTargetDeltaValues({
    actuals,
    targets,
    key: 't',
    actual: phase.stats?.t?.avg,
    target: phase.stats?.tt?.avg,
  });
}

function addPhaseTargetDeltaValues({ phase, actuals, targets }) {
  if (!phase.profilePhase) return;
  addDurationTargetDelta({ phase, actuals, targets });
  addPumpedTargetDelta({ phase, actuals, targets });
  addWeightTargetDelta({ phase, actuals, targets });
  addMetricTargetDelta({
    phase,
    actuals,
    targets,
    key: 'p',
    targetType: 'pressure',
  });
  addMetricTargetDelta({
    phase,
    actuals,
    targets,
    key: 'f',
    targetType: 'flow',
  });
  addTemperatureTargetDelta({ phase, actuals, targets });
}

function buildPhaseMap(entries) {
  const phaseMap = new Map();

  for (const { analysis } of entries) {
    if (!analysis.phases) continue;
    for (const phase of analysis.phases) {
      const name = phase.displayName || phase.name || `Phase ${phase.number + 1}`;
      if (!phaseMap.has(name)) {
        phaseMap.set(name, []);
      }
      phaseMap.get(name).push(phase);
    }
  }

  return phaseMap;
}

function addExitReasonCounts({ phases, phaseCounts, totalCounts }) {
  for (const phase of phases) {
    const reason = phase.exit?.reason || 'Unknown';
    phaseCounts[reason] = (phaseCounts[reason] || 0) + 1;
    totalCounts[reason] = (totalCounts[reason] || 0) + 1;
  }
}

function aggregatePhaseMetrics({ statsArray, metricKeys, allStatsArrays }) {
  const metrics = {};
  for (const key of metricKeys) {
    metrics[key] = aggregateMetricStats(statsArray, key);
    if (!allStatsArrays[key]) allStatsArrays[key] = [];
    allStatsArrays[key].push(...statsArray);
  }
  return metrics;
}

function buildTotalPhaseMetrics({ metricKeys, allStatsArrays }) {
  const totalMetrics = {};
  for (const key of metricKeys) {
    totalMetrics[key] = allStatsArrays[key]
      ? aggregateMetricStats(allStatsArrays[key], key)
      : { avg: 0, min: 0, max: 0, stdDev: 0 };
  }
  return totalMetrics;
}

function computePhaseStats(entries) {
  const phaseMap = buildPhaseMap(entries);
  const result = [];
  let totalDuration = 0;
  let totalWater = 0;
  let totalShotCount = 0;
  const totalExitReasons = {};
  const allStatsArrays = {};
  const metricKeys = ['p', 'f', 'pf', 't', 'w'];

  for (const [phaseName, phases] of phaseMap) {
    const durations = phases.map(p => p.duration).filter(Number.isFinite);
    const waters = phases.map(p => p.water).filter(Number.isFinite);
    const exitReasonDistribution = {};
    const statsArray = phases.map(p => p.stats).filter(Boolean);
    addExitReasonCounts({
      phases,
      phaseCounts: exitReasonDistribution,
      totalCounts: totalExitReasons,
    });
    const metrics = aggregatePhaseMetrics({ statsArray, metricKeys, allStatsArrays });
    const targetDeltas = computePhaseTargetDeltas(phases);

    const avgDur = averageOf(durations);
    const avgWat = averageOf(waters);
    // Accumulate weighted sums so the total row reflects a proper weighted average.
    totalDuration += avgDur * phases.length;
    totalWater += avgWat * phases.length;
    totalShotCount += phases.length;

    result.push({
      phaseName,
      shotCount: phases.length,
      avgDuration: avgDur,
      avgWater: avgWat,
      exitReasonDistribution,
      metrics,
      targetDeltas,
    });
  }

  // Add total row
  const totalMetrics = buildTotalPhaseMetrics({ metricKeys, allStatsArrays });

  result.push({
    phaseName: 'Total',
    shotCount: totalShotCount,
    avgDuration: totalShotCount ? totalDuration / totalShotCount : 0,
    avgWater: totalShotCount ? totalWater / totalShotCount : 0,
    exitReasonDistribution: totalExitReasons,
    metrics: totalMetrics,
    isTotal: true,
  });

  return result;
}

function computeTrends(entries) {
  const sorted = [...entries].sort((a, b) => (a.meta.timestamp || 0) - (b.meta.timestamp || 0));

  return sorted.map(({ analysis, meta }) => {
    const total = analysis.total || {};
    return {
      timestamp: meta.timestamp,
      shotId: meta.id,
      profileName: meta.profileName || '(Unknown)',
      duration: total.duration || 0,
      weight: total.weight || 0,
      water: total.water || 0,
      avgPressure: total.p?.avg || 0,
      avgFlow: total.f?.avg || 0,
      avgTemp: total.t?.avg || 0,
      avgPuckFlow: total.pf?.avg || 0,
    };
  });
}

export function computeStatistics(entries) {
  if (!entries || entries.length === 0) {
    return {
      summary: {
        totalShots: 0,
        totalDuration: 0,
        totalWater: 0,
        totalWeight: 0,
        avgDuration: 0,
        avgWater: 0,
        avgWeight: 0,
        avgTemp: 0,
        avgTempTargetDeviation: 0,
        dateRange: { earliest: null, latest: null },
        sourceBreakdown: { gaggimate: 0, browser: 0 },
      },
      metrics: {},
      profileGroups: [],
      phaseStats: [],
      trends: [],
    };
  }

  return {
    summary: computeSummary(entries),
    metrics: computeMetricAverages(entries),
    profileGroups: computeProfileGroups(entries),
    phaseStats: computePhaseStats(entries),
    trends: computeTrends(entries),
  };
}
