class ArchiveMergeService {
  buildImportPlan(preview) {
    if (!preview?.canImport) {
      return {
        canExecute: false,
        reason: 'Import preview is not importable.',
        plan: null,
      };
    }

    const shotsToImport = preview.actions.shots
      .filter(item => item.action === 'import')
      .map(item => item.identity);

    const shotsToSkip = preview.actions.shots
      .filter(item => item.action === 'skip-duplicate')
      .map(item => item.identity);

    const profilesToRestoreAsCopy = preview.actions.profiles
      .filter(item => item.action === 'import-snapshot')
      .map(item => item.identity);

    const profilesToPreserve = preview.actions.profiles
      .filter(item => item.action === 'preserve-existing')
      .map(item => item.identity);

    const notesToMerge = preview.actions.notes
      .filter(item => item.action === 'import')
      .map(item => item.identity);

    const notesToPreserve = preview.actions.notes
      .filter(item => item.action === 'preserve-existing')
      .map(item => item.identity);

    return {
      canExecute: true,
      plan: {
        shotsToImport,
        shotsToSkip,
        profilesToRestoreAsCopy,
        profilesToPreserve,
        notesToMerge,
        notesToPreserve,
        warnings: [
          'Profiles are restore-as-copy only.',
          'Existing profiles are never overwritten.',
          'Duplicate shots are skipped.',
        ],
      },
      summary: {
        importShots: shotsToImport.length,
        skipShots: shotsToSkip.length,
        restoreProfiles: profilesToRestoreAsCopy.length,
        preserveProfiles: profilesToPreserve.length,
        mergeNotes: notesToMerge.length,
      },
    };
  }
}

export const archiveMergeService = new ArchiveMergeService();
