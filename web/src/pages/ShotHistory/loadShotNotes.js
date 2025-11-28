// Reusable helper to load notes for a shot

/**
 * Load notes for a given shot id.
 * - Fetches notes via apiService.request({ tp: 'req:history:notes:get', id })
 * - Parses JSON if needed
 * - Applies defaults
 * - Prefills doseOut from volume when available
 * - Computes the ratio when possible
 *
 * @param {any} apiService - Api service from context
 * @param {{id: string|number, volume?: number}} shotLike - Object containing at least id, may include volume
 * @returns {Promise<object>} notes object
 */
export async function loadShotNotes(apiService, shotLike) {
  const shotId = shotLike.id;
  const volume = shotLike.volume;

  // defaults
  const base = {
    id: shotId,
    rating: 0,
    beanType: '',
    doseIn: '',
    doseOut: '',
    ratio: '',
    grindSetting: '',
    balanceTaste: 'balanced',
    notes: '',
  };

  try {
    const response = await apiService.request({ tp: 'req:history:notes:get', id: shotId });

    let loaded = { ...base };

    if (response?.notes && Object.keys(response.notes).length > 0) {
      let parsedNotes = response.notes;
      if (typeof response.notes === 'string') {
        try {
          parsedNotes = JSON.parse(response.notes);
        } catch (e) {
          console.warn('Failed to parse notes JSON:', e);
          parsedNotes = {};
        }
      }
      loaded = { ...loaded, ...parsedNotes };
    }

    // Pre-populate doseOut with shot.volume if it's empty and volume exists
    if (!loaded.doseOut && typeof volume === 'number') {
      loaded.doseOut = volume.toFixed(1);
    }

    // Calculate ratio
    if (loaded.doseIn && loaded.doseOut && Number.parseFloat(loaded.doseIn) > 0 &&  Number.parseFloat(loaded.doseOut) > 0) {
      loaded.ratio = ( Number.parseFloat(loaded.doseOut) /  Number.parseFloat(loaded.doseIn)).toFixed(2);
    }

    return loaded;
  } catch (error) {
    console.error('Failed to load notes:', error);
    const fallback = { ...base };
    if (typeof volume === 'number') {
      fallback.doseOut = volume.toFixed(1);
    }
    return fallback;
  }
}
