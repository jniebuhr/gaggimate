import { useEffect, useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { machine } from '../services/ApiService.js';
import { notesService } from '../pages/ShotAnalyzer/services/NotesService';
import { syncBeanUsageFromNotes } from '../utils/beanManager.js';

const DOSE_STORAGE_KEY = 'gaggimate-dose-grams';

/**
 * Watches for shot completion and automatically attaches the stored dose
 * as doseIn to the shot's notes, then subtracts from the selected bean's quantity.
 */
export function useShotDoseRecorder(api, onDoseAttached) {
  const status = computed(() => machine.value.status);
  const wasFinishedRef = useRef(false);
  const mountedRef = useRef(true);
  const activeShotIdRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      wasFinishedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const processInfo = status.value.process;
    const finished = !!processInfo?.e && !processInfo?.a;

    // Cache the shot ID while the shot is actively recording
    if (processInfo?.id) {
      activeShotIdRef.current = processInfo.id;
    }

    // Detect transition to finished state
    if (finished && !wasFinishedRef.current) {
      wasFinishedRef.current = true;

      const doseStr = localStorage.getItem(DOSE_STORAGE_KEY);
      if (!doseStr) return;

      const dose = parseFloat(doseStr);
      if (!Number.isFinite(dose) || dose <= 0) return;

      const shotId = activeShotIdRef.current;
      if (!shotId) return;

      notesService.setApiService(api);
      notesService.saveNotes(shotId, 'gaggimate', { doseIn: dose }).then(async () => {
        localStorage.removeItem(DOSE_STORAGE_KEY);
        activeShotIdRef.current = null;
        const nextNotes = { doseIn: dose, beanType: status.value.selectedBean };
        try {
          const updatedBean = await syncBeanUsageFromNotes(api, {}, nextNotes);
          if (!updatedBean) {
            console.warn(`No matching bean found for '${nextNotes.beanType}' — bean quantity not updated`);
          }
        } catch (syncErr) {
          console.error('Failed to sync bean usage:', syncErr);
        }
        if (mountedRef.current) {
          onDoseAttached?.(dose);
        }
      }).catch(err => {
        console.error('Failed to attach dose to shot notes:', err);
        localStorage.removeItem(DOSE_STORAGE_KEY);
        activeShotIdRef.current = null;
      });
    }

    if (!finished) {
      wasFinishedRef.current = false;
    }
  }, [status.value.process, api]);
}