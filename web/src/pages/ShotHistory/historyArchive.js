import { indexedDBService } from '../ShotAnalyzer/services/IndexedDBService';
import { notesService } from '../ShotAnalyzer/services/NotesService';

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function normalizeSample(sample = {}) {
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

function normalizeNotes(notes, shotKey) {
  const defaults = notesService.getDefaults(shotKey);
  return {
    ...defaults,
    ...(notes || {}),
    id: String(shotKey),
  };
}

export function buildShotHistoryArchive(shots) {
  return {
    type: 'gaggimate-shot-history',
    version: 1,
    exportedAt: new Date().toISOString(),
    shotCount: shots.length,
    shots: shots.map(shot => ({
      ...shot,
      id: String(shot.id || ''),
      source: undefined,
      loaded: true,
      samples: Array.isArray(shot.samples) ? shot.samples.map(normalizeSample) : [],
      notes: normalizeNotes(shot.notes, shot.id),
      volume: round2(shot.volume),
      data: null,
    })),
  };
}

export async function importShotHistoryArchive(payload) {
  let rawShots = [];
  if (Array.isArray(payload)) {
    rawShots = payload;
  } else if (Array.isArray(payload?.shots)) {
    rawShots = payload.shots;
  } else if (payload?.samples) {
    rawShots = [payload];
  }

  if (rawShots.length === 0) {
    throw new Error('No shots found in the selected file.');
  }

  const importedShots = [];

  for (const rawShot of rawShots) {
    const hasSamples = Array.isArray(rawShot?.samples) && rawShot.samples.length > 0;
    const hasCoreHistoryFields = rawShot?.id && rawShot?.timestamp && rawShot?.profile;

    if (!hasSamples && !hasCoreHistoryFields) {
      continue;
    }

    // Generate unique ID: prefer id (original), then timestamp, then Date.now() fallback
    let shotId = String(rawShot.id || rawShot.timestamp || Date.now());
    let storageKey = `history-${shotId}.json`;

    // Check for collision and generate new ID if needed
    try {
      const existingShot = await indexedDBService.getShot(storageKey);
      if (existingShot) {
        // Shot with this ID already exists — generate new timestamp-based ID
        const timestamp = Date.now();
        shotId = String(timestamp);
        storageKey = `history-${shotId}.json`;
      }
    } catch (e) {
      // getShot threw a real DB error (not "not found") — proceed without collision check
      // A true collision will be handled by IndexedDB's natural overwrite behavior
    }

    const normalizedNotes = normalizeNotes(rawShot.notes, storageKey);

    const browserShot = {
      ...rawShot,
      id: shotId,
      name: storageKey,
      storageKey,
      source: 'browser',
      loaded: hasSamples,
      notes: normalizedNotes,
      data: null,
    };

    await indexedDBService.saveShot(browserShot);
    await notesService.saveNotes(storageKey, 'browser', normalizedNotes);
    importedShots.push(browserShot);
  }

  if (importedShots.length === 0) {
    throw new Error('The selected file did not contain any valid shot history entries.');
  }

  return importedShots;
}
