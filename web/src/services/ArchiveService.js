import { indexedDBService } from '../pages/ShotAnalyzer/services/IndexedDBService.js';

const ARCHIVE_VERSION = '1.0.0';
const ARCHIVE_SCHEMA_VERSION = 1;
const ARCHIVE_EXTENSION = '.gaggigo.zip';

function stableJson(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableJson(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
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
  delete copy.loaded;
  delete copy.storageKey;
  delete copy.name;
  delete copy.data;

  return copy;
}

function buildShotIdentity(shot = {}) {
  const sampleCount = Array.isArray(shot.samples) ? shot.samples.length : 0;
  return [shot.gaggimateId || shot.id || '', shot.timestamp || '', shot.profileId || '', sampleCount, shot.duration || '']
    .map(value => String(value))
    .join(':');
}

function buildBundleName(date = new Date()) {
  const year = date.getFullYear();
  const half = date.getMonth() < 6 ? 'H1' : 'H2';
  return `${year}-${half}${ARCHIVE_EXTENSION}`;
}

function normaliseArchiveShot(shot = {}) {
  return {
    ...stripRuntimeOnlyFields(shot),
    archiveIdentity: buildShotIdentity(shot),
    originalSource: shot.source || 'unknown',
  };
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
   * Build the archive payload from the existing IndexedDB mirror.
   * This prepares archive records, manifest, and integrity data only.
   * It does not create ZIP files, write to GaggiMate, or mutate local storage.
   */
  async prepareArchiveBundle(options = {}) {
    const createdAt = options.createdAt || new Date().toISOString();
    const bundleName = options.bundleName || buildBundleName(new Date(createdAt));

    const [rawShots, rawProfiles] = await Promise.all([
      indexedDBService.getAllShots(),
      indexedDBService.getAllProfiles(),
    ]);

    const rawNotes = await this.getAllNotes();
    const shots = rawShots.map(normaliseArchiveShot);
    const profiles = rawProfiles.map(normaliseArchiveProfile);
    const notes = rawNotes.map(normaliseArchiveNote);

    const payload = {
      shots,
      profiles,
      notes,
      metadata: {
        generatedBy: 'GaggiGo',
        createdAt,
        source: 'IndexedDB hot mirror',
      },
    };

    const integrity = await this.buildIntegrity(payload);
    const manifest = this.buildManifest({
      bundleName,
      createdAt,
      shots,
      profiles,
      notes,
      integrity,
    });

    return {
      bundleName,
      manifest,
      payload,
      integrity,
    };
  }

  async getAllNotes() {
    const db = await indexedDBService.init();
    return db.getAll('notes');
  }

  buildManifest({ bundleName, createdAt, shots, profiles, notes, integrity }) {
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
        persistence: 'IndexedDB hot mirror',
        authority: 'LibraryService -> IndexedDBService -> IndexedDB',
      },
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
