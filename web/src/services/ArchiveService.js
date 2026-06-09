/* global globalThis */

import { indexedDBService } from '../pages/ShotAnalyzer/services/IndexedDBService.js';
import { libraryService } from '../pages/ShotAnalyzer/services/LibraryService.js';

const ARCHIVE_VERSION = '1.0.0';
const ARCHIVE_SCHEMA_VERSION = 1;
const ARCHIVE_EXTENSION = '.gaggigo.zip';

function stableJsonEntry(value, key) {
  return `${JSON.stringify(key)}:${stableJson(value[key])}`;
}

function stableJson(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableJson(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  return `{${keys.map(key => stableJsonEntry(value, key)).join(',')}}`;
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(content) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA256 integrity requires crypto.subtle support');
  }

  const encoded = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(digest);
}

function stripRuntimeOnlyFields(record = {}) {
  const copy = { ...record };

  delete copy.source;
  delete copy.uploadedAt;
  delete copy.cachedAt;
  delete copy.storageKey;
  delete copy.name;

  return copy;
}

function hasSamples(shot = {}) {
  return Array.isArray(shot.samples) && shot.samples.length > 0;
}

function getShotDiagnosticId(shot = {}) {
  return String(shot.gaggimateId || shot.id || shot.storageKey || shot.name || '').trim();
}

function buildShotIdentity(shot = {}) {
  const sampleCount = Array.isArray(shot.samples) ? shot.samples.length : 0;
  return [shot.gaggimateId || shot.id || '', shot.timestamp || '', shot.profileId || '', sampleCount, shot.duration || '']
    .map(String)
    .join(':');
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function buildBundleTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());
  const second = padDatePart(date.getSeconds());

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function buildBundleName(date = new Date()) {
  const year = date.getFullYear();
  const half = date.getMonth() < 6 ? 'H1' : 'H2';
  return `${year}-${half}-${buildBundleTimestamp(date)}${ARCHIVE_EXTENSION}`;
}

function normaliseArchiveShot(shot = {}) {
  const archivedShot = {
    ...stripRuntimeOnlyFields(shot),
    archiveIdentity: buildShotIdentity(shot),
    originalSource: shot.source || 'unknown',
  };

  if (!hasSamples(archivedShot)) {
    archivedShot.archiveWarning = 'summary-only-local-shot';
    archivedShot.archiveWarningId = getShotDiagnosticId(shot);
    archivedShot.archiveWarningName = 'SummaryOnlyShot';
    archivedShot.archiveWarningMessage = 'Local canonical shot record has no samples. Backup contains summary metadata only for this shot.';
  }

  return archivedShot;
}

function normaliseArchiveProfile(profile = {}) {
  return {
    ...stripRuntimeOnlyFields(profile),
    label: profile.label || profile.name || '',
    originalSource: profile.source || 'unknown',
  };
}

function normaliseArchiveNote(note = {}) {
  return { ...note };
}

class ArchiveService {
  /**
   * Build the archive payload from the canonical local shot mirror only.
   * Backup export must not hydrate, fetch, call GaggiMate, or mutate local storage.
   */
  async prepareArchiveBundle(options = {}) {
    const createdAt = options.createdAt || new Date().toISOString();
    const bundleName = options.bundleName || buildBundleName(new Date(createdAt));
    const dataLoaders = [
      libraryService.getAllShots('both'),
      indexedDBService.getAllProfiles(),
      this.getAllNotes(),
    ];

    const [rawShots, rawProfiles, rawNotes] = await Promise.all(dataLoaders);
    const shots = this.buildArchiveShots(rawShots);
    const profiles = rawProfiles.map(normaliseArchiveProfile);
    const notes = rawNotes.map(normaliseArchiveNote);
    const hydration = this.buildHydrationSummary(shots);

    const payload = {
      shots,
      profiles,
      notes,
      metadata: {
        generatedBy: 'GaggiGo',
        createdAt,
        source: 'Canonical local shot mirror',
        exportMode: 'canonical-local-indexeddb-only',
      },
    };

    const integrity = await this.buildIntegrity(payload);
    const manifest = this.buildManifest({
      bundleName,
      createdAt,
      shots,
      profiles,
      notes,
      hydration,
      integrity,
    });

    return {
      bundleName,
      manifest,
      payload,
      integrity,
    };
  }

  buildArchiveShots(rawShots = []) {
    return rawShots.map(normaliseArchiveShot);
  }

  buildHydrationSummary(shots = []) {
    const hydratedShots = shots.filter(hasSamples).length;
    const sampleCount = shots.reduce(
      (total, shot) => total + (Array.isArray(shot.samples) ? shot.samples.length : 0),
      0,
    );
    const warnings = shots
      .filter(shot => Boolean(shot.archiveWarning))
      .map(shot => ({
        id: shot.archiveWarningId || getShotDiagnosticId(shot),
        warning: shot.archiveWarning,
        errorName: shot.archiveWarningName || '',
        message: shot.archiveWarningMessage || '',
      }));

    return {
      hydratedShots,
      summaryOnlyShots: shots.length - hydratedShots,
      sampleCount,
      warningCount: warnings.length,
      warnings,
    };
  }

  async getAllNotes() {
    const db = await indexedDBService.init();
    return db.getAll('notes');
  }

  buildManifest({ bundleName, createdAt, shots, profiles, notes, hydration, integrity }) {
    return {
      archiveVersion: ARCHIVE_VERSION,
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      bundleType: 'half-year-hot-mirror-export',
      bundleName,
      createdAt,
      counts: {
        shots: shots.length,
        profiles: profiles.length,
        notes: notes.length,
      },
      source: {
        app: 'GaggiGo',
        persistence: 'Canonical local IndexedDB mirror',
        authority: 'LibraryService.getAllShots(local) -> IndexedDBService -> IndexedDB',
        exportMode: 'canonical-local-indexeddb-only',
      },
      hydration,
      storageMetrics: {
        shotsJsonBytes: stableJson(shots).length,
        profilesJsonBytes: stableJson(profiles).length,
        notesJsonBytes: stableJson(notes).length,
      },
      integrity,
    };
  }

  async buildIntegrity(payload) {
    const shotPayload = stableJson(payload.shots);
    const profilePayload = stableJson(payload.profiles);
    const notesPayload = stableJson(payload.notes);
    const metadataPayload = stableJson(payload.metadata);

    return {
      algorithm: 'SHA-256',
      sections: {
        shots: await sha256(shotPayload),
        profiles: await sha256(profilePayload),
        notes: await sha256(notesPayload),
        metadata: await sha256(metadataPayload),
      },
      overall: await sha256(stableJson(payload)),
    };
  }
}

export const archiveService = new ArchiveService();
