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
    if (!shotData || !shotData.time_array || !shotData.pressure_array) {
      throw new Error('Invalid shot data: missing required arrays');
    }

    // Calculate timestamp (Unix timestamp in seconds)
    const startTime = shotData.start_time ? new Date(shotData.start_time) : new Date();
    const timestamp = Math.floor(startTime.getTime() / 1000);

    // Convert arrays to Gaggimate sample format
    const samples = shotData.time_array.map((time, index) => ({
      t: time * 1000, // Convert to milliseconds
      cp: shotData.pressure_array[index] || 0, // Current pressure
      fl: shotData.flow_array ? shotData.flow_array[index] || 0 : 0, // Flow
      tp: shotData.pressure_array[index] || 0, // Target pressure (same as current for now)
      tf: shotData.flow_array ? shotData.flow_array[index] || 0 : 0, // Target flow
      tt: shotData.temperature_array ? shotData.temperature_array[index] || 92 : 92, // Target temp
      ct: shotData.temperature_array ? shotData.temperature_array[index] || 92 : 92, // Current temp
      v: shotData.weight_array ? shotData.weight_array[index] || (index * 0.5) : (index * 0.5), // Scale weight
      ev: shotData.weight_array ? shotData.weight_array[index] || (index * 0.5) : (index * 0.5), // Estimated weight
      vf: shotData.flow_array ? shotData.flow_array[index] || 0 : 0, // Scale flow
      pf: shotData.flow_array ? shotData.flow_array[index] || 0 : 0 // Predicted flow
    }));

    // Create Gaggimate-style shot file
    return {
      timestamp: timestamp,
      profile: {
        label: shotData.profile_title || "GaggiMate Shot",
        // Add other profile fields if needed
      },
      samples: samples,
      // Add metadata
      bean_brand: shotData.bean_brand || "",
      bean_type: shotData.bean_type || "",
      grinder_model: shotData.grinder_model || "",
      espresso_enjoyment: shotData.espresso_enjoyment || 75
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
      timePoints: formattedData.time.length,
      sampleData: {
        firstTime: formattedData.time[0],
        lastTime: formattedData.time[formattedData.time.length - 1],
        maxPressure: Math.max(...formattedData.pressure),
        maxFlow: Math.max(...formattedData.flow)
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
