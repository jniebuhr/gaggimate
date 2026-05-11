import { useEffect, useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { machine } from '../services/ApiService.js';
import { notesService } from '../pages/ShotAnalyzer/services/NotesService';
import { syncBeanUsageFromNotes } from '../utils/beanManager.js';

// dose: numeric grams value from the caller's state (not localStorage, so it persists across shots)
export function useShotDoseRecorder(api, dose, onDoseAttached) {
  const status = computed(() => machine.value.status);
  const mountedRef = useRef(true);
  const savedForShotRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const processInfo = status.value.process;
    const shotId = processInfo?.id;
    const isActive = !!processInfo?.a;

    // Reset when no shot is running
    if (!shotId) {
      savedForShotRef.current = null;
      return;
    }

    // Save once per shot, as soon as the shot ID appears while active
    if (!isActive || savedForShotRef.current === shotId) return;
    savedForShotRef.current = shotId;

    const hasDose = Number.isFinite(dose) && dose > 0;
    const beanType = status.value.selectedBean || '';

    if (!hasDose && !beanType) return;

    const notesToSave = {};
    if (hasDose) notesToSave.doseIn = dose;
    if (beanType) notesToSave.beanType = beanType;

    notesService.setApiService(api);
    notesService.saveNotes(shotId, 'gaggimate', notesToSave)
      .then(async () => {
        try {
          const updatedBean = await syncBeanUsageFromNotes(api, {}, notesToSave);
          if (beanType && !updatedBean) {
            console.warn(`No matching bean found for '${beanType}' — bean quantity not updated`);
          }
        } catch (syncErr) {
          console.error('Failed to sync bean usage:', syncErr);
        }
        if (mountedRef.current) {
          onDoseAttached?.(hasDose ? dose : null);
        }
      })
      .catch(err => console.error('Failed to attach notes to shot:', err));
  }, [status.value.process, api, dose]);
}
