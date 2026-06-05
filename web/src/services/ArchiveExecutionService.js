import { archiveImportService } from './ArchiveImportService.js';
import { archiveMergeService } from './ArchiveMergeService.js';
import { indexedDBService } from '../pages/ShotAnalyzer/services/IndexedDBService.js';

function shotIdentity(shot = {}) {
  if (shot.archiveIdentity) return String(shot.archiveIdentity);

  const sampleCount = Array.isArray(shot.samples) ? shot.samples.length : 0;
  return [shot.gaggimateId || shot.id || '', shot.timestamp || '', shot.profileId || '', sampleCount, shot.duration || '']
    .map(value => String(value))
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

    for (const identity of mergePlan.plan.shotsToImport) {
      const shot = shotsByIdentity.get(identity);
      if (!shot) continue;

      try {
        await indexedDBService.saveShot({
          ...shot,
          source: 'archive-import',
          archiveIdentity: identity,
          importedAt: Date.now(),
        });
        imported.shots += 1;
      } catch (error) {
        errors.push({ type: 'shot', identity, error: error.message });
      }
    }

    for (const identity of mergePlan.plan.profilesToRestoreAsCopy) {
      const profile = profilesByIdentity.get(identity);
      if (!profile) continue;

      try {
        await indexedDBService.saveProfile({
          ...profile,
          label: restoreProfileLabel(profile),
          source: 'archive-import',
          archiveIdentity: identity,
          restoredAsCopy: true,
          importedAt: Date.now(),
        });
        imported.profiles += 1;
      } catch (error) {
        errors.push({ type: 'profile', identity, error: error.message });
      }
    }

    for (const identity of mergePlan.plan.notesToMerge) {
      const note = notesByIdentity.get(identity);
      if (!note) continue;

      try {
        await indexedDBService.saveNotes({
          ...note,
          source: 'archive-import',
          archiveIdentity: identity,
          importedAt: Date.now(),
        });
        imported.notes += 1;
      } catch (error) {
        errors.push({ type: 'note', identity, error: error.message });
      }
    }

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
