import { indexedDBService } from '../../services/IndexedDBService';
import { notesService } from '../../services/NotesService';
import { cleanName } from '../../utils/analyzerUtils';
import { useCallback } from 'preact/hooks';

function createImportOutcome() {
  return {
    appliedImportCount: 0,
    mismatchedImportCount: 0,
    blockedSecondaryProfileImport: false,
  };
}

function mergeImportOutcome(target, source) {
  target.appliedImportCount += source.appliedImportCount;
  target.mismatchedImportCount += source.mismatchedImportCount;
  target.blockedSecondaryProfileImport =
    target.blockedSecondaryProfileImport || source.blockedSecondaryProfileImport;
}

async function buildImportedShot({ data, file, importMode }) {
  const source = importMode === 'browser' ? 'browser' : 'temp';
  const storageKey = file.name;
  let notesWithId = null;
  const importedNotes = data.notes;
  const shotData = { ...data };
  delete shotData.notes;

  const shot = {
    ...shotData,
    id: String(shotData.id ?? storageKey),
    name: file.name,
    storageKey,
    data: shotData,
    source,
  };
  if (source === 'browser') await indexedDBService.saveShot(shot);

  if (importedNotes && typeof importedNotes === 'object') {
    notesWithId = {
      ...notesService.getDefaults(storageKey),
      ...importedNotes,
      id: storageKey,
    };
    await notesService.saveNotes(storageKey, source, notesWithId);
  }

  return notesWithId ? { ...shot, notes: notesWithId } : shot;
}

async function importShotFile({
  data,
  file,
  targetType,
  slot,
  importMode,
  currentShot,
  compareMode,
  onCompareShotToggle,
  onShotSelect,
}) {
  const outcome = createImportOutcome();
  if (targetType === 'profile') {
    outcome.mismatchedImportCount += 1;
    return outcome;
  }

  const importedShot = await buildImportedShot({ data, file, importMode });
  if (slot === 'secondary' && currentShot) {
    await onCompareShotToggle?.(importedShot, true);
  } else {
    onShotSelect?.({
      item: importedShot,
      name: file.name,
      preserveCompare: compareMode,
    });
  }
  outcome.appliedImportCount += 1;
  return outcome;
}

async function importProfileFile({
  data,
  file,
  targetType,
  slot,
  importMode,
  currentShot,
  secondaryShot,
  onCompareProfileLoad,
  onProfileLoad,
}) {
  const outcome = createImportOutcome();
  if (targetType === 'shot') {
    outcome.mismatchedImportCount += 1;
    return outcome;
  }

  const profileName = data.label || cleanName(file.name);
  const profileData = data.label ? data : { ...data, label: profileName };
  const profile = {
    ...profileData,
    data: profileData,
    fileName: file.name,
    source: importMode === 'browser' ? 'browser' : 'temp',
  };
  if (importMode === 'browser') await indexedDBService.saveProfile(profile);

  if (slot !== 'secondary') {
    onProfileLoad(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
    return outcome;
  }

  if (secondaryShot) {
    onCompareProfileLoad?.(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
  } else if (currentShot) {
    outcome.blockedSecondaryProfileImport = true;
  } else {
    onProfileLoad(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
  }

  return outcome;
}

async function importAnalyzerFile({ file, data, ...options }) {
  if (data.samples) return importShotFile({ file, data, ...options });
  if (data.phases) return importProfileFile({ file, data, ...options });
  return createImportOutcome();
}

function showImportOutcomeAlerts({ outcome, targetType }) {
  if (outcome.appliedImportCount > 0) return;

  if (outcome.blockedSecondaryProfileImport) {
    alert('Load a secondary shot before importing a secondary profile.');
    return;
  }

  if (outcome.mismatchedImportCount > 0) {
    alert(
      targetType === 'shot'
        ? 'Only shot files can be imported in the shot field.'
        : 'Only profile files can be imported in the profile field.',
    );
  }
}

export function useLibraryPanelImportHandler({
  currentShot,
  secondaryShot,
  importMode,
  compareMode,
  onShotSelect,
  onProfileLoad,
  onCompareShotToggle,
  onCompareProfileLoad,
  refreshLibraries,
  setImporting,
}) {
  return useCallback(
    async (files, { targetType = 'any', slot = 'primary' } = {}) => {
      setImporting(true);

      setTimeout(async () => {
        const outcome = createImportOutcome();

        try {
          for (const file of Array.from(files)) {
            const text = await file.text();
            const data = JSON.parse(text);
            const fileOutcome = await importAnalyzerFile({
              data,
              file,
              targetType,
              slot,
              importMode,
              currentShot,
              secondaryShot,
              compareMode,
              onCompareShotToggle,
              onShotSelect,
              onCompareProfileLoad,
              onProfileLoad,
            });
            mergeImportOutcome(outcome, fileOutcome);
          }

          showImportOutcomeAlerts({ outcome, targetType });
        } catch (error) {
          console.error('Import error:', error);
          alert('Import failed. Please check the file format.');
        } finally {
          setImporting(false);
          refreshLibraries();
        }
      }, 50);
    },
    [
      compareMode,
      currentShot,
      importMode,
      onCompareProfileLoad,
      onCompareShotToggle,
      onProfileLoad,
      onShotSelect,
      refreshLibraries,
      secondaryShot,
      setImporting,
    ],
  );
}
