function round2(value) {
  if (value == null || Number.isNaN(value)) return value;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeShotSample(sample = {}) {
  return {
    t: sample.t,
    tt: round2(sample.tt),
    ct: round2(sample.ct),
    tp: round2(sample.tp),
    cp: round2(sample.cp),
    fl: round2(sample.fl),
    tf: round2(sample.tf),
    pf: round2(sample.pf),
    vf: round2(sample.vf),
    v: round2(sample.v),
    ev: round2(sample.ev),
    pr: round2(sample.pr),
    systemInfo: sample.systemInfo,
    phaseNumber: sample.phaseNumber,
    phaseDisplayNumber: sample.phaseDisplayNumber,
  };
}

export function buildShotExport(shot = {}, notes = shot.notes ?? null) {
  const exportData = { ...shot, notes };
  if (Array.isArray(exportData.samples)) {
    exportData.samples = exportData.samples.map(normalizeShotSample);
  }
  exportData.volume = round2(exportData.volume);
  return exportData;
}
