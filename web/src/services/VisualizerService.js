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
  formatShotData(shot) {
    if (!shot.samples || shot.samples.length === 0) {
      throw new Error('No shot data available');
    }

    // Extract all available data arrays from samples
    const time = [];
    const targetTemp = [];
    const currentTemp = [];
    const targetPressure = [];
    const currentPressure = [];
    const pumpFlow = [];
    const targetFlow = [];
    const puckFlow = [];
    const volumetricFlow = [];
    const volume = [];
    const estimatedVolume = [];
    const puckResistance = [];

    shot.samples.forEach(sample => {
      // Convert time from milliseconds to seconds for visualizer.coffee
      time.push(sample.t / 1000);
      
      // Temperature data
      targetTemp.push(sample.tt || 0);
      currentTemp.push(sample.ct || 0);
      
      // Pressure data
      targetPressure.push(sample.tp || 0);
      currentPressure.push(sample.cp || 0);
      
      // Flow data
      pumpFlow.push(sample.fl || 0);
      targetFlow.push(sample.tf || 0);
      puckFlow.push(sample.pf || 0);
      volumetricFlow.push(sample.vf || 0);
      
      // Volume data
      volume.push(sample.v || 0);
      estimatedVolume.push(sample.ev || 0);
      
      // Resistance data
      puckResistance.push(sample.pr || 0);
    });

    // Include all shot data that would be in the JSON export
    return {
      // Core data arrays (what the API example showed)
      time,
      pressure: currentPressure,
      flow: volumetricFlow,
      
      // Extended data arrays (full dataset)
      targetTemp,
      currentTemp,
      targetPressure,
      currentPressure,
      pumpFlow,
      targetFlow,
      puckFlow,
      volumetricFlow,
      volume,
      estimatedVolume,
      puckResistance,
      
      // Shot metadata
      id: shot.id,
      profile: shot.profile,
      timestamp: shot.timestamp,
      duration: shot.duration,
      version: shot.version,
      
      // Final values for summary
      finalVolume: shot.volume,
      finalDuration: shot.duration,
      
      // Notes if available
      ...(shot.notes && { notes: shot.notes })
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
    
    // Create basic auth header
    const credentials = btoa(`${username}:${password}`);
    
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(formattedData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
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
