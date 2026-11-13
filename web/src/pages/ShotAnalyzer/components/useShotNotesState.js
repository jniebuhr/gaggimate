import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mergeAnalyzerNotes, rebaseAnalyzerNotes } from '../services/analyzerNotesMerge';
import { notesService } from '../services/NotesService';
import { cleanName, detectDoseFromProfileName, getShotStorageKey } from '../utils/analyzerUtils';

let notesStateOriginCounter = 0;

function reportSaveError(error) {
  console.error('Failed to save Analyzer notes:', error);
  alert(
    error.notesConflict
      ? t`Notes changed elsewhere. Your changes were not saved. Reopen the shot to load the latest notes.`
      : t`Notes could not be loaded or saved safely. Your changes were not saved. Reopen the shot to try again.`,
  );
}

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
  if (!currentShot) return t`No Shot Loaded`;
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
  const notesKey = currentShot ? getShotNotesKey(currentShot) : '';
  const source = currentShot?.source;
  const shotRef = useRef(currentShot);
  shotRef.current = currentShot;
  const session = useMemo(
    () => ({
      key: notesKey,
      source,
      shot: shotRef.current,
      notes: notesService.getDefaults(notesKey),
      baseline: null,
      blocked: false,
      active: true,
    }),
    [notesKey, source],
  );
  const localUpdateVersionRef = useRef(0);
  const originIdRef = useRef(null);
  const saveTimerRef = useRef(null);

  if (!originIdRef.current) {
    notesStateOriginCounter += 1;
    originIdRef.current = `shot-notes-state-${notesStateOriginCounter}`;
  }

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

  const saveNotes = useCallback(
    async (notesToSave = session.notes) => {
      if (!session.shot) return;
      const { key: notesKey, source } = session;
      if (session.active) setSaving(true);
      try {
        if (source === 'gaggimate') {
          const submitted = { ...notesToSave };
          const saved = await notesService.saveAnalyzerMachineNotes(notesKey, submitted, session);
          if (!saved) return;
          const updated = rebaseAnalyzerNotes(submitted, session.notes, saved);
          session.notes = updated;
          if (session.active) setNotes(updated);
          notesService.publishNotesUpdate(notesKey, source, updated, originIdRef.current, saved);
        } else {
          await notesService.saveNotes(notesKey, source, notesToSave);
        }
      } catch (error) {
        reportSaveError(error);
      } finally {
        if (session.active) setSaving(false);
      }
    },
    [session],
  );

  useEffect(() => {
    const currentShot = session.shot;
    const source = session.source;
    if (!currentShot) {
      setLoading(false);
      setNotes(notesService.getDefaults(null));
      return undefined;
    }

    let cancelled = false;
    session.active = true;
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
        const updated = meta.persistedNotes
          ? rebaseAnalyzerNotes(session.baseline || nextNotes, session.notes, meta.persistedNotes)
          : nextNotes;
        if (meta.persistedNotes) session.baseline = meta.persistedNotes;
        session.notes = updated;
        setNotes(updated);
      },
    );

    setLoading(true);
    setSaving(false);
    if (inlineNotes) {
      session.notes = inlineNotes;
      setNotes(inlineNotes);
    }

    const initialNotes = session.notes;
    const loadedNotes =
      source === 'gaggimate'
        ? notesService.loadAnalyzerMachineNotes(notesKey)
        : notesService.loadNotes(notesKey, source);
    session.ready = loadedNotes
      .then(loaded => {
        if (cancelled) return;
        if (source !== 'gaggimate' && localUpdateVersionRef.current !== loadStartedAtVersion)
          return;
        session.baseline = loaded;
        let persistedNotes = loaded;
        if (source === 'gaggimate') {
          persistedNotes = mergeAnalyzerNotes(initialNotes, session.notes, loaded);
        } else if (inlineNotes) {
          persistedNotes = { ...loaded, ...inlineNotes, id: notesKey };
        }
        const { nextNotes, autoSave } = hydrateLoadedShotNotes({
          loaded: persistedNotes,
          currentShot,
        });

        session.notes = nextNotes;
        setNotes(nextNotes);

        if (autoSave && currentShot.source !== 'temp') {
          void saveNotes(nextNotes);
        }
      })
      .catch(error => {
        if (cancelled) return;
        session.blocked = true;
        reportSaveError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      session.active = false;
      unsubscribeNotes();
    };
  }, [session, saveNotes]);

  const handleInputChange = useCallback(
    (field, value) => {
      const updated = updateNotesValue(session.notes, field, value);
      localUpdateVersionRef.current += 1;
      session.notes = updated;
      setNotes(updated);
      publishNotes(updated);
    },
    [publishNotes, session],
  );

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(() => {
    clearSaveTimer();
    void saveNotes();
  }, [clearSaveTimer, saveNotes]);

  const scheduleSave = useCallback(() => {
    clearSaveTimer();
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveNotes();
    }, 650);
  }, [clearSaveTimer, saveNotes]);

  const handleFieldChange = useCallback(
    (field, value) => {
      handleInputChange(field, value);
      scheduleSave();
    },
    [handleInputChange, scheduleSave],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) flushSave();
    },
    [currentShot, flushSave],
  );

  const updateAndSave = useCallback(
    async (field, value) => {
      const updated = updateNotesValue(session.notes, field, value);
      localUpdateVersionRef.current += 1;
      session.notes = updated;
      setNotes(updated);
      publishNotes(updated);
      await saveNotes(updated);
    },
    [publishNotes, saveNotes, session],
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
    handleFieldChange,
    saveNotes,
    flushSave,
    updateAndSave,
  };
}
