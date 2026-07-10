import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { notesService } from '../services/NotesService';
import { cleanName, detectDoseFromProfileName, getShotStorageKey } from '../utils/analyzerUtils';

let notesStateOriginCounter = 0;

export function getShotNotesKey(shot) {
  return String(getShotStorageKey(shot) || '');
}

export function getShotDateTimeLabel(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export function getAnalyzerShotDisplayName(currentShot, currentShotName = '') {
  if (!currentShot) return 'No Shot Loaded';
  if (currentShot.source === 'gaggimate') return `#${currentShot.id || currentShotName || '-'}`;
  return cleanName(
    currentShotName || currentShot.name || currentShot.storageKey || currentShot.id || '-',
  );
}

function calculateRatio(doseIn, doseOut) {
  if (doseIn && doseOut && Number.parseFloat(doseIn) > 0 && Number.parseFloat(doseOut) > 0) {
    return (Number.parseFloat(doseOut) / Number.parseFloat(doseIn)).toFixed(2);
  }
  return '';
}

function hydrateLoadedShotNotes({ loaded, currentShot }) {
  const nextNotes = { ...loaded };
  let autoSave = false;

  if (!nextNotes.doseIn && currentShot.profile) {
    const extractedDose = detectDoseFromProfileName(currentShot.profile);
    if (extractedDose !== null) {
      nextNotes.doseIn = String(extractedDose);
      autoSave = true;
    }
  }

  if (!nextNotes.doseOut && currentShot.volume) {
    nextNotes.doseOut = currentShot.volume.toFixed(1);
    autoSave = true;
  }

  if (nextNotes.doseIn && nextNotes.doseOut) {
    nextNotes.ratio = calculateRatio(nextNotes.doseIn, nextNotes.doseOut);
  }

  return { nextNotes, autoSave };
}

function updateNotesValue(notes, field, value) {
  const updated = { ...notes, [field]: value };
  if (field === 'doseIn' || field === 'doseOut') {
    const dIn = field === 'doseIn' ? value : notes.doseIn;
    const dOut = field === 'doseOut' ? value : notes.doseOut;
    updated.ratio = calculateRatio(dIn, dOut);
  } else if (field === 'ratio') {
    if (updated.doseOut) {
      updated.doseIn = (Number.parseFloat(updated.doseOut) / Number.parseFloat(value)).toFixed(1);
    } else if (updated.doseIn) {
      updated.doseOut = (Number.parseFloat(updated.doseIn) * Number.parseFloat(value)).toFixed(1);
    }
  }
  return updated;
}

export function useShotNotesState({ currentShot, isSelectionPending = false } = {}) {
  const [notes, setNotes] = useState(notesService.getDefaults(null));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const notesRef = useRef(notes);
  const localUpdateVersionRef = useRef(0);
  const originIdRef = useRef(null);

  if (!originIdRef.current) {
    notesStateOriginCounter += 1;
    originIdRef.current = `shot-notes-state-${notesStateOriginCounter}`;
  }

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const publishNotes = useCallback(
    notesToPublish => {
      if (!currentShot) return;
      notesService.publishNotesUpdate(
        getShotNotesKey(currentShot),
        currentShot.source,
        notesToPublish,
        originIdRef.current,
      );
    },
    [currentShot],
  );

  useEffect(() => {
    if (!currentShot) {
      setLoading(false);
      setNotes(notesService.getDefaults(null));
      return undefined;
    }

    let cancelled = false;
    const notesKey = getShotNotesKey(currentShot);
    const loadStartedAtVersion = localUpdateVersionRef.current;
    const inlineNotes =
      currentShot.notes && typeof currentShot.notes === 'object'
        ? { ...notesService.getDefaults(notesKey), ...currentShot.notes, id: notesKey }
        : null;
    const unsubscribeNotes = notesService.subscribeNotes(
      notesKey,
      currentShot.source,
      (nextNotes, meta = {}) => {
        if (meta.originId === originIdRef.current) return;
        localUpdateVersionRef.current += 1;
        notesRef.current = nextNotes;
        setNotes(nextNotes);
      },
    );

    setLoading(true);
    if (inlineNotes) {
      notesRef.current = inlineNotes;
      setNotes(inlineNotes);
    }

    notesService
      .loadNotes(notesKey, currentShot.source)
      .then(loaded => {
        if (cancelled) return;
        if (localUpdateVersionRef.current !== loadStartedAtVersion) return;
        const persistedNotes = inlineNotes ? { ...loaded, ...inlineNotes, id: notesKey } : loaded;
        const { nextNotes, autoSave } = hydrateLoadedShotNotes({
          loaded: persistedNotes,
          currentShot,
        });

        notesRef.current = nextNotes;
        setNotes(nextNotes);

        if (autoSave && currentShot.source !== 'temp') {
          notesService.saveNotes(notesKey, currentShot.source, nextNotes);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribeNotes();
    };
  }, [
    currentShot,
    currentShot?.id,
    currentShot?.name,
    currentShot?.source,
    currentShot?.storageKey,
  ]);

  const handleInputChange = useCallback(
    (field, value) => {
      setNotes(prev => {
        const updated = updateNotesValue(prev, field, value);
        localUpdateVersionRef.current += 1;
        notesRef.current = updated;
        publishNotes(updated);
        return updated;
      });
    },
    [publishNotes],
  );

  const saveNotes = useCallback(
    async (notesToSave = notesRef.current) => {
      if (!currentShot) return;
      setSaving(true);
      try {
        await notesService.saveNotes(getShotNotesKey(currentShot), currentShot.source, notesToSave);
      } catch (error) {
        console.error('Failed to save notes:', error);
      } finally {
        setSaving(false);
      }
    },
    [currentShot],
  );

  const updateAndSave = useCallback(
    async (field, value) => {
      const updated = updateNotesValue(notesRef.current, field, value);
      localUpdateVersionRef.current += 1;
      notesRef.current = updated;
      setNotes(updated);
      publishNotes(updated);
      await saveNotes(updated);
    },
    [publishNotes, saveNotes],
  );

  useEffect(() => {
    if (!isSelectionPending) return;
    setLoading(true);
  }, [isSelectionPending]);

  return {
    notes,
    saving,
    loading,
    handleInputChange,
    saveNotes,
    updateAndSave,
  };
}
