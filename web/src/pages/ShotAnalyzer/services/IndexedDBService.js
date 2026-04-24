/**
 * IndexedDBService.js
 *
 * Browser-side storage for uploaded shots and profiles
 * These are temporary uploads for analysis and NOT saved to GaggiMate controller
 */

import { openDB } from 'idb';

const DB_NAME = 'gaggimate-analyzer';
const DB_VERSION = 3;

function normalizeStoredProfile(profile = {}) {
  const label = String(profile.label || profile.name || profile.fileName || profile.exportName || '').trim();
  if (!label) return null;

  const normalized = {
    ...profile,
    label,
    source: 'browser',
  };
  delete normalized.name;
  return normalized;
}

class IndexedDBService {
  constructor() {
    this.db = null;
    this._initPromise = null;
  }

  /**
   * Initialize the database.
   * Caches the init promise to prevent concurrent openDB calls.
   */
  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('shots')) {
          db.createObjectStore('shots', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'label' });
        } else if (oldVersion < 3) {
          const existingProfiles = await transaction.objectStore('profiles').getAll();
          db.deleteObjectStore('profiles');
          const profileStore = db.createObjectStore('profiles', { keyPath: 'label' });

          existingProfiles.forEach(profile => {
            const normalizedProfile = normalizeStoredProfile(profile);
            if (normalizedProfile) profileStore.put(normalizedProfile);
          });
        }
        // v2: Dedicated notes store (same JSON format as GaggiMate API)
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
      },
    })
      .then(db => {
        this.db = db;
        return db;
      })
      .catch(err => {
        this._initPromise = null;
        throw err;
      });

    return this._initPromise;
  }

  /**
   * Save a shot to browser storage
   * @param {Object} shot - Shot data with metadata
   */
  async saveShot(shot) {
    const db = await this.init();
    const storageKey = String(shot.storageKey || shot.name || shot.id || Date.now());

    // Add source tag and storage timestamp
    const shotWithMeta = {
      ...shot,
      name: storageKey,
      storageKey,
      source: 'browser',
      uploadedAt: Date.now(),
    };

    await db.put('shots', shotWithMeta);
    return shotWithMeta;
  }

  /**
   * Get all browser-uploaded shots
   * @returns {Array} List of shots
   */
  async getAllShots() {
    const db = await this.init();
    const shots = await db.getAll('shots');

    // Ensure all have source tag
    return shots.map(shot => ({
      ...shot,
      storageKey: shot.storageKey || shot.name || String(shot.id || ''),
      source: 'browser',
    }));
  }

  /**
   * Get a single shot by name
   * @param {string} name - Shot filename/ID
   */
  async getShot(name) {
    const db = await this.init();
    return db.get('shots', name);
  }

  /**
   * Delete a shot from browser storage
   * @param {string} name - Shot filename/ID
   */
  async deleteShot(name) {
    const db = await this.init();
    await db.delete('shots', name);
  }

  /**
   * Save a profile to browser storage
   * @param {Object} profile - Profile data
   */
  async saveProfile(profile) {
    const db = await this.init();
    const normalizedProfile = normalizeStoredProfile(profile);
    if (!normalizedProfile) {
      throw new Error('Profile label is required for browser storage');
    }

    // Add source tag and storage timestamp
    const profileWithMeta = {
      ...normalizedProfile,
      source: 'browser',
      uploadedAt: Date.now(),
    };

    await db.put('profiles', profileWithMeta);
    return profileWithMeta;
  }

  /**
   * Get all browser-uploaded profiles
   * @returns {Array} List of profiles
   */
  async getAllProfiles() {
    const db = await this.init();
    const profiles = await db.getAll('profiles');

    // Ensure all have source tag
    return profiles
      .map(normalizeStoredProfile)
      .filter(Boolean)
      .map(profile => ({
        ...profile,
        source: 'browser',
      }));
  }

  /**
   * Get a single profile by label
   * @param {string} label - Profile label
   */
  async getProfile(label) {
    const db = await this.init();
    return db.get('profiles', label);
  }

  /**
   * Delete a profile from browser storage
   * @param {string} label - Profile label
   */
  async deleteProfile(label) {
    const db = await this.init();
    await db.delete('profiles', label);
  }

  /**
   * Save notes for a shot
   * @param {Object} notes - Notes object with id, rating, beanType, etc.
   */
  async saveNotes(notes) {
    const db = await this.init();
    await db.put('notes', notes);
  }

  /**
   * Get notes for a shot by ID
   * @param {string} id - Shot ID
   * @returns {Object|undefined} Notes object or undefined
   */
  async getNotes(id) {
    const db = await this.init();
    return db.get('notes', id);
  }

  /**
   * Delete notes for a shot
   * @param {string} id - Shot ID
   */
  async deleteNotes(id) {
    const db = await this.init();
    await db.delete('notes', id);
  }

  /**
   * Clear all browser storage (for reset/cleanup)
   */
  async clearAll() {
    const db = await this.init();
    const tx = db.transaction(['shots', 'profiles', 'notes'], 'readwrite');
    await Promise.all([
      tx.objectStore('shots').clear(),
      tx.objectStore('profiles').clear(),
      tx.objectStore('notes').clear(),
      tx.done,
    ]);
  }

  /**
   * Get storage stats
   * @returns {Object} Count of shots and profiles
   */
  async getStats() {
    const db = await this.init();
    const shotCount = await db.count('shots');
    const profileCount = await db.count('profiles');

    return {
      shots: shotCount,
      profiles: profileCount,
      total: shotCount + profileCount,
    };
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
