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
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

function stdDevOf(values, mean) {
  if (values.length < 2) return 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - mean;
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

function computeSummary(entries) {
  const totalShots = entries.length;
  let totalDuration = 0;
  let totalWater = 0;
  let totalWeight = 0;
  let earliest = Infinity;
  let latest = -Infinity;
  let gmCount = 0;
  let browserCount = 0;

  const tempAvgs = [];
  const tempTargetDeviations = [];

  for (const { analysis, meta } of entries) {
    const total = analysis.total;
    if (total) {
      if (Number.isFinite(total.duration)) totalDuration += total.duration;
      if (Number.isFinite(total.water)) totalWater += total.water;
      if (Number.isFinite(total.weight)) totalWeight += total.weight;
      if (total.t && Number.isFinite(total.t.avg)) tempAvgs.push(total.t.avg);
      if (total.t && Number.isFinite(total.t.avg) && total.tt && Number.isFinite(total.tt.avg)) {
        tempTargetDeviations.push(Math.abs(total.t.avg - total.tt.avg));
      }
    }
    if (Number.isFinite(meta.timestamp)) {
      if (meta.timestamp < earliest) earliest = meta.timestamp;
      if (meta.timestamp > latest) latest = meta.timestamp;
    }
    if (meta.source === 'gaggimate') gmCount++;
    else browserCount++;
  }

  const avgTemp = averageOf(tempAvgs);
  const avgTempTargetDeviation = averageOf(tempTargetDeviations);

  return {
    totalShots,
    totalDuration,
    totalWater,
    totalWeight,
    avgDuration: totalShots ? totalDuration / totalShots : 0,
    avgWater: totalShots ? totalWater / totalShots : 0,
    avgWeight: totalShots ? totalWeight / totalShots : 0,
    avgTemp,
    avgTempTargetDeviation,
    dateRange: {
      earliest: earliest === Infinity ? null : earliest,
      latest: latest === -Infinity ? null : latest,
    },
    sourceBreakdown: { gaggimate: gmCount, browser: browserCount },
  };
}

function computeMetricAverages(entries) {
  const totals = entries.map(e => e.analysis.total).filter(Boolean);
  const keys = ['p', 'f', 'pf', 't', 'w'];
  const metrics = {};
  for (const key of keys) {
    metrics[key] = aggregateMetricStats(totals, key);
  }
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
      metrics[key] = aggregateMetricStats(totals, key);
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
 * Uses delay-corrected targetCalcValues when available, falls back to raw measured values.
 */
function computePhaseTargetDeltas(phases, calcMode) {
  const keys = ['duration', 'water', 'p', 'f', 't', 'w'];
  const actuals = {};
  const targets = {};
  for (const k of keys) {
    actuals[k] = [];
    targets[k] = [];
  }

  for (const phase of phases) {
    const pp = phase.profilePhase;
    if (!pp) continue;

    // Duration
    if (Number.isFinite(pp.duration) && Number.isFinite(phase.duration)) {
      actuals.duration.push(phase.duration);
      targets.duration.push(pp.duration);
    }

    // Water / pumped target
    const pumpedTarget = pp.targets?.find(t => t.type === 'pumped');
    if (pumpedTarget && Number.isFinite(phase.water)) {
      const calcVal = calcMode ? phase.targetCalcValues?.pumped : null;
      const actual = calcVal ? calcVal.value : phase.water;
      actuals.water.push(actual);
      targets.water.push(pumpedTarget.value);
    }

    // Weight target (weight or volumetric)
    const weightTarget = pp.targets?.find(t => t.type === 'weight' || t.type === 'volumetric');
    if (weightTarget && Number.isFinite(phase.weight)) {
      const calcKey = weightTarget.type;
      const calcVal = calcMode ? phase.targetCalcValues?.[calcKey] : null;
      const actual = calcVal ? calcVal.value : (phase.prediction?.finalWeight ?? phase.weight);
      actuals.w.push(actual);
      targets.w.push(weightTarget.value);
    }

    // Pressure target
    const pressureTarget = pp.targets?.find(t => t.type === 'pressure');
    if (pressureTarget && phase.stats?.p) {
      const calcVal = calcMode ? phase.targetCalcValues?.pressure : null;
      const actual = calcVal ? calcVal.value : phase.stats.p.avg;
      actuals.p.push(actual);
      targets.p.push(pressureTarget.value);
    }

    // Flow target
    const flowTarget = pp.targets?.find(t => t.type === 'flow');
    if (flowTarget && phase.stats?.f) {
      const calcVal = calcMode ? phase.targetCalcValues?.flow : null;
      const actual = calcVal ? calcVal.value : phase.stats.f.avg;
      actuals.f.push(actual);
      targets.f.push(flowTarget.value);
    }

    // Temp: setpoint avg
    if (phase.stats?.t && phase.stats?.tt) {
      const tAvg = phase.stats.t.avg;
      const ttAvg = phase.stats.tt.avg;
      if (Number.isFinite(tAvg) && Number.isFinite(ttAvg)) {
        actuals.t.push(tAvg);
        targets.t.push(ttAvg);
      }
    }
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

function computePhaseStats(entries, calcMode) {
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

    for (const phase of phases) {
      const reason = phase.exit?.reason || 'Unknown';
      exitReasonDistribution[reason] = (exitReasonDistribution[reason] || 0) + 1;
      totalExitReasons[reason] = (totalExitReasons[reason] || 0) + 1;
    }

    const metrics = {};
    const statsArray = phases.map(p => p.stats).filter(Boolean);
    for (const key of metricKeys) {
      metrics[key] = aggregateMetricStats(statsArray, key);
      if (!allStatsArrays[key]) allStatsArrays[key] = [];
      allStatsArrays[key].push(...statsArray);
    }

    // Compute target deltas
    const targetDeltas = computePhaseTargetDeltas(phases, calcMode);

    const avgDur = averageOf(durations);
    const avgWat = averageOf(waters);
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
  const totalMetrics = {};
  for (const key of metricKeys) {
    totalMetrics[key] = allStatsArrays[key]
      ? aggregateMetricStats(allStatsArrays[key], key)
      : { avg: 0, min: 0, max: 0, stdDev: 0 };
  }

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

export function computeStatistics(entries, options = {}) {
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
    phaseStats: computePhaseStats(entries, !!options.calcMode),
    trends: computeTrends(entries),
  };
}
