import { useEffect, useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { machine } from '../services/ApiService.js';
import { notesService } from '../pages/ShotAnalyzer/services/NotesService';

const DOSE_STORAGE_KEY = 'gaggimate-dose-grams';

/**
 * Watches for shot completion and automatically attaches the stored dose
 * as doseIn to the shot's notes, then subtracts from the selected bean's quantity.
 */
export function useShotDoseRecorder(api, onDoseAttached) {
  const status = computed(() => machine.value.status);
  const wasFinishedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const processInfo = status.value.process;
    const finished = !!processInfo?.e && !processInfo?.a;

    // Detect transition to finished state
    if (finished && !wasFinishedRef.current) {
      wasFinishedRef.current = true;

      const doseStr = localStorage.getItem(DOSE_STORAGE_KEY);
      if (!doseStr) return;

      const dose = parseFloat(doseStr);
      if (!Number.isFinite(dose) || dose <= 0) return;

      // Get the most recently completed shot ID from machine status
      const shotId = status.value.process?.id;
      if (!shotId) return;

      // Attach dose to shot notes via NotesService
      notesService.setApiService(api);
      notesService.saveNotes(shotId, 'gaggimate', { doseIn: dose }).then(() => {
        localStorage.removeItem(DOSE_STORAGE_KEY);
        if (mountedRef.current) {
          onDoseAttached?.(dose);
        }
      }).catch(err => {
        console.error('Failed to attach dose to shot notes:', err);
        localStorage.removeItem(DOSE_STORAGE_KEY);
      });
    }

    if (!finished) {
      wasFinishedRef.current = false;
    }
  }, [status.value.process, api]);
}