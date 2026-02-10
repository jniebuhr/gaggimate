/**
 * LibraryService.js
 * 
 * Unified service for loading shots and profiles from multiple sources:
 * - GaggiMate Controller (via API)
 * - Browser Uploads (via IndexedDB)
 */

import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex';
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
                name: shot.profile || shot.id || 'Unknown',
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
        // Check if WebSocket is connected
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
            // Keep the real API id for loading, use label for display
            return response.profiles.map(profile => ({
                ...profile,
                name: profile.label || profile.name || 'Unknown', // Display name
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

        // Load from selected sources
        if (sourceFilter === 'both' || sourceFilter === 'gaggimate') {
            promises.push(this.getGaggiMateProfiles());
        }
        if (sourceFilter === 'both' || sourceFilter === 'browser') {
            promises.push(this.getBrowserProfiles());
        }

        const results = await Promise.all(promises);
        const merged = results.flat();

        // Sort by name
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
            const { parseBinaryShot } = await import('../../ShotHistory/parseBinaryShot');
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
            // Load from GaggiMate controller
            if (!this.apiService) {
                throw new Error('ApiService not set');
            }

            // Check WebSocket connection
            if (!this.apiService.socket || 
                this.apiService.socket.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket not connected');
            }

            // GM uses the numeric/uuid profile id (not the label)
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
            // Load from browser storage
            const profile = await indexedDBService.getProfile(nameOrId);
            if (!profile) {
                throw new Error(`Profile ${nameOrId} not found in browser storage`);
            }
            return profile;
        }
    }

    /**
     * Delete a shot
     * @param {string} id - Shot ID
     * @param {string} source - 'gaggimate' or 'browser'
     */
    async deleteShot(id, source) {
        if (source === 'gaggimate') {
            // Delete from GaggiMate controller
            if (!this.apiService) {
                throw new Error('ApiService not set');
            }

            await this.apiService.request({
                tp: 'req:history:delete',
                id: id
            });
        } else {
            // Delete from browser storage
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
            // Delete from GaggiMate controller
            if (!this.apiService) {
                throw new Error('ApiService not set');
            }

            await this.apiService.request({
                tp: 'req:profiles:delete',
                id: name
            });
        } else {
            // Delete from browser storage
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

// Export singleton instance
export const libraryService = new LibraryService();
