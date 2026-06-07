import { archiveImportService } from './ArchiveImportService.js';
import { archiveMergeService } from './ArchiveMergeService.js';
import { indexedDBService } from '../pages/ShotAnalyzer/services/IndexedDBService.js';

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

function restoreProfileLabel(profile = {}) {
  const baseLabel = String(profile.label || profile.name || profile.profileId || profile.id || 'Archived Profile').trim();
  return `${baseLabel} (Restored)`;
}

async function importEntities(identities, entityMap, saveFn, importedKey, imported, errors, entityType) {
  for (const identity of identities) {
    const entity = entityMap.get(identity);
    if (!entity) continue;

    try {
      await saveFn(entity, identity);
      imported[importedKey] += 1;
    } catch (error) {
      errors.push({ type: entityType, identity, error: error.message });
    }
  }
}

class ArchiveExecutionService {
  async executeImport(input) {
    const preview = await archiveImportService.previewImport(input);
    const mergePlan = archiveMergeService.buildImportPlan(preview);

    if (!mergePlan.canExecute) {
      return {
        success: false,
        reason: mergePlan.reason,
        imported: { shots: 0, profiles: 0, notes: 0 },
        skipped: preview?.summary || {},
      };
    }

    const bundle = preview.bundle;

    const shotsByIdentity = new Map(bundle.payload.shots.map(shot => [shotIdentity(shot), shot]));
    const profilesByIdentity = new Map(bundle.payload.profiles.map(profile => [profileIdentity(profile), profile]));
    const notesByIdentity = new Map(bundle.payload.notes.map(note => [noteIdentity(note), note]));

    const imported = { shots: 0, profiles: 0, notes: 0 };
    const errors = [];

    await importEntities(
      mergePlan.plan.shotsToImport,
      shotsByIdentity,
      (shot, identity) => indexedDBService.saveShot({
        ...shot,
        source: 'archive-import',
        archiveIdentity: identity,
        importedAt: Date.now(),
      }),
      'shots',
      imported,
      errors,
      'shot',
    );

    await importEntities(
      mergePlan.plan.profilesToRestoreAsCopy,
      profilesByIdentity,
      (profile, identity) => indexedDBService.saveProfile({
        ...profile,
        label: restoreProfileLabel(profile),
        source: 'archive-import',
        archiveIdentity: identity,
        restoredAsCopy: true,
        importedAt: Date.now(),
      }),
      'profiles',
      imported,
      errors,
      'profile',
    );

    await importEntities(
      mergePlan.plan.notesToMerge,
      notesByIdentity,
      (note, identity) => indexedDBService.saveNotes({
        ...note,
        source: 'archive-import',
        archiveIdentity: identity,
        importedAt: Date.now(),
      }),
      'notes',
      imported,
      errors,
      'note',
    );

    return {
      success: errors.length === 0,
      imported,
      skipped: {
        shots: mergePlan.plan.shotsToSkip.length,
        profiles: mergePlan.plan.profilesToPreserve.length,
        notes: mergePlan.plan.notesToPreserve.length,
      },
      warnings: mergePlan.plan.warnings,
      errors,
    };
  }
}

export const archiveExecutionService = new ArchiveExecutionService();
