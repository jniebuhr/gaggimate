/**
 * LibraryService.js
 * 
 * Unified service for loading shots and profiles from multiple sources:
 * - GaggiMate Controller (via API)
 * - Browser Uploads (via IndexedDB)
 */

import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex';
import { parseBinaryShot } from '../../ShotHistory/parseBinaryShot';
import { indexedDBService } from './IndexedDBService';

class LibraryService {
    constructor() {
        this.apiService = null;
    }

    /**
     * Set API service reference
     * @param {ApiService} apiService
     */
    setApiService(apiService) {
        this.apiService = apiService;
    }

    /**
     * Get shots from GaggiMate controller
     * @returns {Array} List of GaggiMate shots with source tag
     */
    async getGaggiMateShots() {
        try {
            const response = await fetch('/api/history/index.bin');
            
            if (!response.ok) {
                if (response.status === 404) {
                    // No shots yet
                    console.log('No shot index found on GM');
                    return [];
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const indexData = parseBinaryIndex(arrayBuffer);
            const shotList = indexToShotList(indexData);

            // Add source tag and ensure name property exists
            return shotList.map(shot => ({
                ...shot,
                name: shot.profile || shot.id || 'Unknown', // Display Name for UI (e.g. "Turbo Bloom")
                exportName: `shot-${shot.id}.json`,         // Real Filename for Export (e.g. "shot-1701234.json")
                source: 'gaggimate'
            }));
        } catch (error) {
            console.error('Failed to load GaggiMate shots:', error);
            return [];
        }
    }

    /**
     * Get shots from browser uploads
     * @returns {Array} List of browser shots with source tag
     */
    async getBrowserShots() {
        try {
            return await indexedDBService.getAllShots();
        } catch (error) {
            console.error('Failed to load browser shots:', error);
            return [];
        }
    }

    /**
     * Get merged shot list from all sources
     * @param {string} sourceFilter - 'both', 'gaggimate', or 'browser'
     * @returns {Array} Filtered and merged shot list
     */
    async getAllShots(sourceFilter = 'both') {
        const promises = [];

        // Load from selected sources
        if (sourceFilter === 'both' || sourceFilter === 'gaggimate') {
            promises.push(this.getGaggiMateShots());
        }
        if (sourceFilter === 'both' || sourceFilter === 'browser') {
            promises.push(this.getBrowserShots());
        }

        const results = await Promise.all(promises);
        const merged = results.flat();

        // Sort by timestamp (newest first)
        return merged.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Get profiles from GaggiMate controller
     * @returns {Array} List of GaggiMate profiles with source tag
     */
    async getGaggiMateProfiles() {
        if (!this.apiService || 
            !this.apiService.socket || 
            this.apiService.socket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not ready, skipping GM profiles');
            return [];
        }

        try {
            const response = await this.apiService.request({
                tp: 'req:profiles:list'
            });

            if (!response.profiles) {
                return [];
            }

            // Add source tag and normalize name property
            return response.profiles.map(profile => ({
                ...profile,
                name: profile.label || profile.name || 'Unknown', // Display name
                exportName: (profile.label || profile.name) + '.json', // Filename
                profileId: profile.id, // Keep real API id for req:profiles:load
                label: profile.label,
                source: 'gaggimate'
            }));
        } catch (error) {
            console.error('Failed to load GaggiMate profiles:', error);
            return [];
        }
    }

    /**
     * Get profiles from browser uploads
     * @returns {Array} List of browser profiles with source tag
     */
    async getBrowserProfiles() {
        try {
            return await indexedDBService.getAllProfiles();
        } catch (error) {
            console.error('Failed to load browser profiles:', error);
            return [];
        }
    }

    /**
     * Get merged profile list from all sources
     * @param {string} sourceFilter - 'both', 'gaggimate', or 'browser'
     * @returns {Array} Filtered and merged profile list
     */
    async getAllProfiles(sourceFilter = 'both') {
        const promises = [];

        if (sourceFilter === 'both' || sourceFilter === 'gaggimate') {
            promises.push(this.getGaggiMateProfiles());
        }
        if (sourceFilter === 'both' || sourceFilter === 'browser') {
            promises.push(this.getBrowserProfiles());
        }

        const results = await Promise.all(promises);
        const merged = results.flat();

        return merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    /**
     * Load full shot data
     * @param {string} id - Shot ID
     * @param {string} source - 'gaggimate' or 'browser'
     * @returns {Object} Full shot data with samples
     */
    async loadShot(id, source) {
        const idStr = String(id);

        if (source === 'gaggimate') {
            const paddedId = idStr.padStart(6, '0');
            const response = await fetch(`/api/history/${paddedId}.slog`);
            
            if (!response.ok) {
                throw new Error(`Failed to load shot ${idStr}: HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return parseBinaryShot(arrayBuffer, idStr);
        } else {
            const shot = await indexedDBService.getShot(idStr);
            if (!shot) {
                throw new Error(`Shot ${idStr} not found in browser storage`);
            }
            return shot;
        }
    }

    /**
     * Load full profile data
     * @param {string} nameOrId - Profile name/ID (for GM: use label)
     * @param {string} source - 'gaggimate' or 'browser'
     * @returns {Object} Full profile data
     */
    async loadProfile(nameOrId, source) {
        if (source === 'gaggimate') {
            if (!this.apiService || !this.apiService.socket || this.apiService.socket.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket not connected');
            }

            const response = await this.apiService.request({
                tp: 'req:profiles:load',
                id: nameOrId
            });

            if (!response.profile) {
                throw new Error(`Profile ${nameOrId} not found`);
            }

            return {
                ...response.profile,
                name: response.profile.label || response.profile.name || nameOrId,
                source: 'gaggimate'
            };
        } else {
            const profile = await indexedDBService.getProfile(nameOrId);
            if (!profile) {
                throw new Error(`Profile ${nameOrId} not found in browser storage`);
            }
            return profile;
        }
    }

    /**
     * PREPARE EXPORT DATA
     * Fetches the original data and cleans it for export.
     * @param {Object} item - The library item (shot or profile)
     * @param {boolean} isShot - True if item is a shot
     * @returns {Object} { exportData, filename }
     */
    async exportItem(item, isShot) {
        console.log("Service Exporting:", item); 

        let exportData = null;
        // 1. Prefer specific exportName (e.g. shot-123.json), else item.name/id
        let filename = item.exportName || item.name || item.id || 'export.json';
        
        // Ensure extension .json (or .slog if preferred)
        if (!filename.toLowerCase().endsWith('.json') && !filename.toLowerCase().endsWith('.slog')) {
            filename += '.json';
        }

        if (item.source === 'gaggimate') {
            if (isShot) {
                // SHOT EXPORT (GM): 
                // We MUST load the full shot because the list item only has summary data.
                // Use the 'id' (timestamp) to load, ignoring the 'name' (profile name).
                const loadId = item.id;
                if (!loadId) throw new Error("Shot ID missing for export");

                const fullShot = await this.loadShot(loadId, 'gaggimate');
                exportData = fullShot; 
            } else {
                // PROFILE EXPORT (GM): 
                // Load fresh from controller using the hidden profileId
                const loadId = item.profileId || item.id;
                if (!loadId) throw new Error("Profile ID missing for export");

                const raw = await this.loadProfile(loadId, 'gaggimate');
                const clean = { ...raw };
                
                // Cleanup internal metadata before export
                delete clean.source;
                // delete clean.name; // Use caution removing name, usually needed inside the file
                delete clean.id;      // Remove internal ID (e.g. "QtQdQjBeav")
                exportData = clean;
            }
        } else {
            // BROWSER EXPORT:
            // Just clean up our internal tags
            exportData = { ... (item.data || item) };
            delete exportData.source;
            delete exportData.uploadedAt;
            // For browser shots, exportData already contains full samples if they were uploaded
        }

        // Return raw object
        // The UI helper 'downloadJson' will handle stringify and blob creation.
        return { exportData, filename };
    }

    /**
     * Delete a shot
     * @param {string} id - Shot ID
     * @param {string} source - 'gaggimate' or 'browser'
     */
    async deleteShot(id, source) {
        if (source === 'gaggimate') {
            if (!this.apiService) throw new Error('ApiService not set');
            await this.apiService.request({ tp: 'req:history:delete', id: id });
        } else {
            await indexedDBService.deleteShot(id);
        }
    }

    /**
     * Delete a profile
     * @param {string} name - Profile name/ID
     * @param {string} source - 'gaggimate' or 'browser'
     */
    async deleteProfile(name, source) {
        if (source === 'gaggimate') {
            if (!this.apiService) throw new Error('ApiService not set');
            await this.apiService.request({ tp: 'req:profiles:delete', id: name });
        } else {
            await indexedDBService.deleteProfile(name);
        }
    }

    /**
     * Get storage statistics
     * @returns {Object} Stats from all sources
     */
    async getStats() {
        const [gmShots, browserShots, gmProfiles, browserProfiles] = await Promise.all([
            this.getGaggiMateShots(),
            this.getBrowserShots(),
            this.getGaggiMateProfiles(),
            this.getBrowserProfiles()
        ]);

        return {
            gaggimate: {
                shots: gmShots.length,
                profiles: gmProfiles.length
            },
            browser: {
                shots: browserShots.length,
                profiles: browserProfiles.length
            },
            total: {
                shots: gmShots.length + browserShots.length,
                profiles: gmProfiles.length + browserProfiles.length
            }
        };
    }
}

export const libraryService = new LibraryService();