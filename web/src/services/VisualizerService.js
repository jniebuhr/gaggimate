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
   * Get CSRF token from the visualizer.coffee site
   */
  async getCSRFToken() {
    try {
      const response = await fetch('https://visualizer.coffee/shots/new', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const text = await response.text();
        const csrfMatch = text.match(/name="csrf-token" content="([^"]+)"/);
        return csrfMatch ? csrfMatch[1] : null;
      }
    } catch (error) {
      console.warn('Could not get CSRF token:', error);
    }
    return null;
  }

  /**
   * Convert shot data from gaggimate format to visualizer.coffee format
   * @param {Object} shot - Shot data from gaggimate
   * @returns {Object} - Formatted data for visualizer.coffee
   */
  // Format shot data as a Gaggimate-style shot file for visualizer.coffee API
  formatShotData(shotData) {
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

    // Create Gaggimate-style shot file
    return {
      timestamp: timestamp,
      profile: {
        label: shotData.profile || "GaggiMate Shot",
        // Add other profile fields if needed
      },
      samples: samples,
      // Add metadata from notes if available
      bean_brand: shotData.notes?.bean_brand || "",
      bean_type: shotData.notes?.bean_type || "",
      grinder_model: shotData.notes?.grinder_model || "",
      espresso_enjoyment: shotData.notes?.espresso_enjoyment || 75
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
      sampleData: {
        firstTime: formattedData.samples[0]?.t || 0,
        lastTime: formattedData.samples[formattedData.samples.length - 1]?.t || 0,
        maxPressure: Math.max(...formattedData.samples.map(s => s.cp || 0)),
        maxFlow: Math.max(...formattedData.samples.map(s => s.fl || 0))
      }
    });
    
    // Create basic auth header
    const credentials = btoa(`${username}:${password}`);
    
    // Try to get CSRF token (for Rails CSRF protection)
    const csrfToken = await this.getCSRFToken();
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
      'User-Agent': 'GaggiMate-WebUI/1.0'
    };
    
    // Add CSRF token if we got one
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
      console.log('Using CSRF token:', csrfToken.substring(0, 10) + '...');
    }
    
    try {
      // First attempt: with potential CSRF token
      let response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: headers,
        credentials: 'include', // Include cookies for session
        body: JSON.stringify(formattedData)
      });

      // If that fails with 422 (unprocessable entity), try without CSRF
      if (!response.ok && response.status === 422) {
        console.log('Retrying without CSRF token...');
        delete headers['X-CSRF-Token'];
        
        response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(formattedData)
        });
      }

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
