// Ratio is derived: edits to input and output on different clients must agree.
function updateRatioAfterDoseChange(notes, previous) {
  if (notes.doseIn !== previous.doseIn || notes.doseOut !== previous.doseOut) {
    const doseIn = Number.parseFloat(notes.doseIn);
    const doseOut = Number.parseFloat(notes.doseOut);
    notes.ratio = doseIn > 0 && doseOut > 0 ? (doseOut / doseIn).toFixed(2) : '';
  }
  return notes;
}

// Three-way merge for Analyzer autosaves only. Empty strings are intentional edits.
export function mergeAnalyzerNotes(
  baseline,
  draft,
  latest,
  fields = null,
  autoFillFields = new Set(),
) {
  const merged = { ...latest };
  const doseChanged = ['doseIn', 'doseOut'].some(
    field => (!fields || fields.has(field)) && draft[field] !== baseline[field],
  );
  for (const field of Object.keys(draft)) {
    if (field === 'id' || (fields && !fields.has(field)) || (field === 'ratio' && doseChanged))
      continue;
    // Automatic defaults must never replace a value added by another client.
    if (
      autoFillFields.has(field) &&
      JSON.stringify(latest[field]) !== JSON.stringify(baseline[field])
    )
      continue;
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
  return updateRatioAfterDoseChange(merged, latest);
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
