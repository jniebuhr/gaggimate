import { archiveImportValidationService } from './ArchiveImportValidationService.js';
import { indexedDBService } from '../pages/ShotAnalyzer/services/IndexedDBService.js';
import { libraryService } from '../pages/ShotAnalyzer/services/LibraryService.js';

function shotIdentity(shot = {}) {
  if (shot.archiveIdentity) return String(shot.archiveIdentity);

  const sampleCount = Array.isArray(shot.samples) ? shot.samples.length : 0;
  return [shot.gaggimateId || shot.id || '', shot.timestamp || '', shot.profileId || '', sampleCount, shot.duration || '']
    .map(String)
    .join(':');
}

function profileIdentity(profile = {}) {
  return String(profile.label || profile.profileId || profile.id || '').trim();
}

function noteIdentity(note = {}) {
  return String(note.id || '').trim();
}

function countByAction(items) {
  return items.reduce(
    (totals, item) => {
      totals[item.action] = (totals[item.action] || 0) + 1;
      return totals;
    },
    {},
  );
}

class ArchiveImportService {
  async previewImport(input) {
    const importValidation = await archiveImportValidationService.validateImportArchive(input);

    if (!importValidation.canImport) {
      return {
        canImport: false,
        validation: importValidation.validation,
        health: importValidation.health,
        summary: {
          shots: {},
          profiles: {},
          notes: {},
        },
        actions: {
          shots: [],
          profiles: [],
          notes: [],
        },
      };
    }

    const bundle = importValidation.bundle;

    const existingShotsPromise = Promise.resolve(libraryService.getAllShots('both'));
    const existingProfilesPromise = Promise.resolve(indexedDBService.getAllProfiles());
    const existingNotesPromise = Promise.resolve(this.getAllNotes());

    const [existingShots, existingProfiles, existingNotes] = await Promise.all([
      existingShotsPromise,
      existingProfilesPromise,
      existingNotesPromise,
    ]);

    const existingShotIdentities = new Set(existingShots.map(shotIdentity));
    const existingProfileIdentities = new Set(existingProfiles.map(profileIdentity));
    const existingNoteIdentities = new Set(existingNotes.map(noteIdentity));

    const shotActions = bundle.payload.shots.map(shot => {
      const identity = shotIdentity(shot);
      const duplicate = existingShotIdentities.has(identity);
      return {
        type: 'shot',
        identity,
        action: duplicate ? 'skip-duplicate' : 'import',
        reason: duplicate ? 'Matching shot identity already exists in canonical local mirror.' : 'New archive shot.',
      };
    });

    const profileActions = bundle.payload.profiles.map(profile => {
      const identity = profileIdentity(profile);
      const duplicate = existingProfileIdentities.has(identity);
      return {
        type: 'profile',
        identity,
        action: duplicate ? 'preserve-existing' : 'import-snapshot',
        reason: duplicate ? 'Profile identity already exists locally.' : 'New archived profile snapshot.',
      };
    });

    const noteActions = bundle.payload.notes.map(note => {
      const identity = noteIdentity(note);
      const duplicate = existingNoteIdentities.has(identity);
      return {
        type: 'note',
        identity,
        action: duplicate ? 'preserve-existing' : 'import',
        reason: duplicate ? 'Local note already exists for this id.' : 'New archived note.',
      };
    });

    return {
      canImport: true,
      validation: importValidation.validation,
      health: importValidation.health,
      manifest: bundle.manifest,
      bundle,
      summary: {
        shots: countByAction(shotActions),
        profiles: countByAction(profileActions),
        notes: countByAction(noteActions),
      },
      actions: {
        shots: shotActions,
        profiles: profileActions,
        notes: noteActions,
      },
    };
  }

  async getAllNotes() {
    const db = await indexedDBService.init();
    return db.getAll('notes');
  }
}

export const archiveImportService = new ArchiveImportService();
