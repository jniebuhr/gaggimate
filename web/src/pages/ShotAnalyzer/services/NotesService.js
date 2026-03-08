/**
 * NotesService.js
 *
 * Dual-persistence notes service for Shot Analyzer.
 * Notes JSON format is identical across all backends:
 *   { id, rating, beanType, doseIn, doseOut, ratio, grindSetting, balanceTaste, notes }
 *
 * - GaggiMate shots: Uses the same API as ShotHistory (req:history:notes:get/save)
 * - Browser shots: Dedicated 'notes' store in IndexedDB (same JSON format as API)
 * - Temp shots: In-memory only, no persistence
 */

import { indexedDBService } from './IndexedDBService';

const DEFAULT_NOTES = {
  rating: 0,
  beanType: '',
  doseIn: '',
  doseOut: '',
  ratio: '',
  grindSetting: '',
  balanceTaste: 'balanced',
  notes: '',
};

class NotesService {
  constructor() {
    this.apiService = null;
    this._tempCache = new Map();
  }

  setApiService(apiService) {
    this.apiService = apiService;
  }

  getDefaults(shotId) {
    return { ...DEFAULT_NOTES, id: shotId };
  }

  async loadNotes(shotId, source) {
    const defaults = this.getDefaults(shotId);

    if (source === 'gaggimate') {
      if (!this.apiService) return defaults;
      try {
        const response = await this.apiService.request({
          tp: 'req:history:notes:get',
          id: shotId,
        });
        if (response.notes) {
          let parsed = response.notes;
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              console.warn('Failed to parse notes JSON:', e);
              parsed = {};
            }
          }
          return { ...defaults, ...parsed };
        }
      } catch (e) {
        console.error('Failed to load notes from API:', e);
      }
      return defaults;
    }

    if (source === 'browser') {
      try {
        const stored = await indexedDBService.getNotes(String(shotId));
        if (stored) {
          return { ...defaults, ...stored };
        }
      } catch (e) {
        console.error('Failed to load notes from IndexedDB:', e);
      }
      return defaults;
    }

    // Temp source: check in-memory cache
    if (this._tempCache.has(String(shotId))) {
      return { ...defaults, ...this._tempCache.get(String(shotId)) };
    }
    return defaults;
  }

  async saveNotes(shotId, source, notes) {
    // Ensure the notes object always has the shot ID
    const notesWithId = { ...notes, id: String(shotId) };

    if (source === 'gaggimate') {
      if (!this.apiService) throw new Error('ApiService not available');
      await this.apiService.request({
        tp: 'req:history:notes:save',
        id: shotId,
        notes: notesWithId,
      });
      return;
    }

    if (source === 'browser') {
      await indexedDBService.saveNotes(notesWithId);
      return;
    }

    // Temp source: store in memory only
    this._tempCache.set(String(shotId), notesWithId);
  }
}

export const notesService = new NotesService();
