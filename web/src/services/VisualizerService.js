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
   * @returns {Object} - Formatted data for visualizer.coffee
   */
  // Format shot data as a Gaggimate-style shot file for visualizer.coffee API
  formatShotData(shotData) {
    // Debug: log the actual structure we're receiving
    console.log('formatShotData received:', {
      hasData: !!shotData,
      hasSamples: !!(shotData && shotData.samples),
      samplesIsArray: !!(shotData && shotData.samples && Array.isArray(shotData.samples)),
      samplesLength: shotData && shotData.samples ? shotData.samples.length : 0,
      shotDataKeys: shotData ? Object.keys(shotData) : [],
      firstSample: shotData && shotData.samples && shotData.samples[0] ? shotData.samples[0] : null,
      notesData: shotData.notes
    });

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
      tp: sample.tp || sample.cp || 0, // Target pressure
      tf: sample.tf || sample.fl || 0, // Target flow  
      tt: sample.tt || 92, // Target temperature
      ct: sample.ct || sample.tt || 92, // Current temperature
      v: sample.v || 0, // Scale weight
      ev: sample.ev || sample.v || 0, // Estimated weight
      vf: sample.vf || 0, // Scale flow
      pf: sample.pf || sample.fl || 0 // Predicted flow
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
    const parseNumeric = (value) => {
      if (!value || value === '') return '';
      const parsed = parseFloat(value);
      return isNaN(parsed) ? value : parsed.toString();
    };
    
    // Create Gaggimate-style shot file with enhanced metadata from shot notes
    return {
      timestamp: timestamp,
      profile: {
        label: shotData.profile || "GaggiMate Shot",
        // Add other profile fields if needed
      },
      samples: samples,
      // Map shot notes fields to visualizer.coffee schema
      bean_weight: parseNumeric(notes.doseIn), // Input dose (grams)
      drink_weight: parseNumeric(notes.doseOut), // Output weight (grams)  
      grinder_model: "GaggiMate", // Fixed grinder model
      grinder_setting: notes.grindSetting || "", // Grind setting from notes
      espresso_enjoyment: enjoyment, // Convert 0-5 stars to 0-100 scale
      espresso_notes: notes.notes || "", // Free-form tasting notes
      bean_brand: "Unknown roaster", // Default since we don't track this in notes
      bean_type: "Unknown bean", // Default since we don't track this in notes
      barista: "GaggiMate User", // Default barista name
      // Additional metadata that could be useful
      roast_level: "", // Not tracked in current notes schema
      roast_date: "" // Not tracked in current notes schema
    };
  }

  /**
   * Upload shot to visualizer.coffee
   * @param {Object} shot - Shot data from gaggimate
   * @param {string} username - Visualizer.coffee username
   * @param {string} password - Visualizer.coffee password
   * @returns {Promise<Object>} - Upload response
   */
  async uploadShot(shot, username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const formattedData = this.formatShotData(shot);
    
    // Log the data being sent for debugging
    console.log('Uploading to visualizer.coffee:', {
      dataSize: JSON.stringify(formattedData).length,
      sampleCount: formattedData.samples.length,
      profile: formattedData.profile.label,
      shotMetadata: {
        bean_weight: formattedData.bean_weight,
        drink_weight: formattedData.drink_weight,
        grinder_model: formattedData.grinder_model,
        grinder_setting: formattedData.grinder_setting,
        espresso_enjoyment: formattedData.espresso_enjoyment,
        espresso_notes: formattedData.espresso_notes?.substring(0, 50) + (formattedData.espresso_notes?.length > 50 ? '...' : ''),
        bean_brand: formattedData.bean_brand,
        bean_type: formattedData.bean_type,
        barista: formattedData.barista
      },
      sampleData: {
        firstTime: formattedData.samples[0]?.t || 0,
        lastTime: formattedData.samples[formattedData.samples.length - 1]?.t || 0,
        maxPressure: Math.max(...formattedData.samples.map(s => s.cp || 0)),
        maxFlow: Math.max(...formattedData.samples.map(s => s.fl || 0))
      }
    });
    
    // Create basic auth header
    const credentials = btoa(`${username}:${password}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
      'User-Agent': 'GaggiMate-WebUI/1.0'
    };
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          bodyPreview: errorText.substring(0, 500)
        });
        
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
    
    // Check if we have at least some pressure or flow data
    const hasData = shot.samples.some(sample => 
      (sample.cp && sample.cp > 0) || (sample.vf && sample.vf > 0)
    );
    
    return hasData;
  }
}

export const visualizerService = new VisualizerService();
