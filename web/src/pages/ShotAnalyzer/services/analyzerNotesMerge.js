// Three-way merge for Analyzer autosaves only. Empty strings are intentional edits.
export function mergeAnalyzerNotes(baseline, draft, latest) {
  const merged = { ...latest };
  const doseChanged = draft.doseIn !== baseline.doseIn || draft.doseOut !== baseline.doseOut;
  for (const field of Object.keys(draft)) {
    if (field === 'id' || (field === 'ratio' && doseChanged)) continue;
    if (JSON.stringify(draft[field]) === JSON.stringify(baseline[field])) continue;
    if (
      JSON.stringify(latest[field]) !== JSON.stringify(baseline[field]) &&
      JSON.stringify(latest[field]) !== JSON.stringify(draft[field])
    ) {
      const error = new Error('Notes changed elsewhere');
      error.notesConflict = true;
      throw error;
    }
    merged[field] = draft[field];
  }
  // Ratio is derived: edits to input and output on different clients must agree.
  if (merged.doseIn !== latest.doseIn || merged.doseOut !== latest.doseOut) {
    const doseIn = Number.parseFloat(merged.doseIn);
    const doseOut = Number.parseFloat(merged.doseOut);
    merged.ratio = doseIn > 0 && doseOut > 0 ? (doseOut / doseIn).toFixed(2) : '';
  }
  return merged;
}

// Keep edits made while a save was in flight on top of its merged result.
export function rebaseAnalyzerNotes(submitted, current, saved) {
  const result = { ...saved };
  const doseChanged = current.doseIn !== submitted.doseIn || current.doseOut !== submitted.doseOut;
  for (const field of Object.keys(current)) {
    if (
      field !== 'id' &&
      !(field === 'ratio' && doseChanged) &&
      JSON.stringify(current[field]) !== JSON.stringify(submitted[field])
    ) {
      result[field] = current[field];
    }
  }
  if (doseChanged) {
    const doseIn = Number.parseFloat(result.doseIn);
    const doseOut = Number.parseFloat(result.doseOut);
    result.ratio = doseIn > 0 && doseOut > 0 ? (doseOut / doseIn).toFixed(2) : '';
  }
  return result;
}
