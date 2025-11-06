/**
 * Service for uploading shots to visualizer.coffee
 *
 * Uploads complete shot data including all time series arrays and metadata,
 * equivalent to what would be in a JSON export from gaggimate.
 */

export class VisualizerService {
  constructor() {
    this.baseUrl = 'https://visualizer.coffee/api/shots/upload';
  }

  /**
   * Convert shot data from gaggimate format to visualizer.coffee format
   * @param {Object} shot - Shot data from gaggimate
   * @param {Object} profileData - Optional full profile data from ProfileManager
   * @returns {Object} - Formatted data for visualizer.coffee
   */
  // Format shot data as a Gaggimate-style shot file for visualizer.coffee API
  formatShotData(shotData, profileData = null) {
    if (!shotData || !shotData.samples || !Array.isArray(shotData.samples)) {
      throw new Error('Invalid shot data: missing required samples array');
    }

    if (shotData.samples.length === 0) {
      throw new Error('Invalid shot data: samples array is empty');
    }

    // Calculate timestamp (Unix timestamp in seconds)
    const startTime = shotData.timestamp ? new Date(shotData.timestamp * 1000) : new Date();
    const timestamp = Math.floor(startTime.getTime() / 1000);

    // The samples are already in the correct Gaggimate format, just need to ensure all fields are present
    const samples = shotData.samples.map(sample => ({
      t: sample.t || 0, // Time in milliseconds
      cp: sample.cp || 0, // Current pressure
      fl: sample.fl || 0, // Flow
      tp: sample.tp || 0, // Target pressure
      tf: sample.tf || 0, // Target flow
      tt: sample.tt || 0, // Target temperature
      ct: sample.ct || 0, // Current temperature
      v: sample.v || 0, // Scale weight
      ev: sample.ev || 0, // Estimated weight
      vf: sample.vf || 0, // Scale flow
      pf: sample.pf || 0, // Predicted flow
    }));

    // Extract shot notes data for enhanced metadata
    const notes = shotData.notes || {};

    // Convert 0-5 rating to 0-100 enjoyment scale
    // Default to 75 (3.75 stars) if no rating provided
    let enjoyment = 75;
    if (notes.rating && notes.rating > 0) {
      enjoyment = Math.round(notes.rating * 20);
      // Ensure it's within valid range
      enjoyment = Math.max(0, Math.min(100, enjoyment));
    }

    // Parse numeric values safely
    const parseNumeric = value => {
      if (!value || value === '') return '';
      const parsed = parseFloat(value);
      return isNaN(parsed) ? value : parsed.toString();
    };

    // Create Gaggimate-style shot file with enhanced metadata from shot notes
    const shotFile = {
      timestamp,
      profile: profileData
        ? {
            label: profileData.label || shotData.profile || 'GaggiMate Shot',
            id: profileData.id,
            type: profileData.type,
            description: profileData.description,
            temperature: profileData.temperature,
            phases: profileData.phases || [],
          }
        : {
            label: shotData.profile || 'GaggiMate Shot',
          },
      samples,
    };

    // Add metadata fields that will be parsed by the Gaggimate parser
    // Based on the GitHub source, these should be added to the root level for the parser to extract
    shotFile.bean_weight = parseNumeric(notes.doseIn); // Input dose (grams)
    shotFile.drink_weight = parseNumeric(notes.doseOut); // Output weight (grams)
    shotFile.grinder_model = 'GaggiMate'; // Fixed grinder model
    shotFile.grinder_setting = notes.grindSetting || ''; // Grind setting from notes
    shotFile.espresso_enjoyment = enjoyment; // Convert 0-5 stars to 0-100 scale
    shotFile.espresso_notes = notes.notes || ''; // Free-form tasting notes
    shotFile.bean_brand = 'Unknown roaster'; // Default since we don't track this in notes
    shotFile.bean_type = notes.beanType; // Default since we don't track this in notes
    shotFile.barista = 'GaggiMate User'; // Default barista name
    shotFile.roast_level = ''; // Not tracked in current notes schema
    shotFile.roast_date = ''; // Not tracked in current notes schema

    return shotFile;
  }

  /**
   * Upload shot to visualizer.coffee
   * @param {Object} shot - Shot data from gaggimate
   * @param {string} username - Visualizer.coffee username
   * @param {string} password - Visualizer.coffee password
   * @param {Object} profileData - Optional full profile data from ProfileManager
   * @returns {Promise<Object>} - Upload response
   */
  async uploadShot(shot, username, password, profileData = null) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const formattedData = this.formatShotData(shot, profileData);

    // Create basic auth header
    const credentials = btoa(`${username}:${password}`);

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'User-Agent': 'GaggiMate-WebUI/1.0',
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if it's an authentication error
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed - please check your username and password');
        }

        // Check if it's a validation error
        if (response.status === 422) {
          throw new Error('Data validation failed - the shot data format may be incorrect');
        }

        // Try to extract useful error info from HTML response
        let errorMsg = `HTTP ${response.status}`;
        if (errorText.includes('No coffee for you')) {
          errorMsg = 'Server error - the API may not support this data format or account type';
        }

        throw new Error(errorMsg);
      }

      return await response.json();
    } catch (fetchError) {
      if (fetchError.name === 'TypeError') {
        throw new Error('Network error: Unable to connect to visualizer.coffee');
      }
      throw fetchError;
    }
  }

  /**
   * Validate shot data before upload
   * @param {Object} shot - Shot data to validate
   * @returns {boolean} - True if valid
   */
  validateShot(shot) {
    if (!shot) return false;
    if (!shot.samples || !Array.isArray(shot.samples)) return false;
    if (shot.samples.length === 0) return false;

    return true;
  }
}

export const visualizerService = new VisualizerService();
