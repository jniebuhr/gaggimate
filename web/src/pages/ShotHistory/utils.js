export function parseHistoryData(shot) {
  const data = {
    id: shot.id,
  };
  if (!shot.history) return null;
  
  const lines = shot.history.split('\n');
  const header = lines[0].split(',');
  data['version'] = header[0];
  data['profile'] = header[1];
  data['timestamp'] = parseInt(header[2], 10);
  data['samples'] = [];
  
  let lastValidVolume = 0;
  let maxVolume = 0;
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) {
      continue;
    }
    
    const numbers = lines[i].split(',');
    
    // Skip incomplete lines (should have 12 columns: t,tt,ct,tp,cp,fl,tf,pf,vf,v,ev,pr)
    if (numbers.length !== 12) {
      console.warn(`Skipping incomplete line ${i}: "${lines[i]}" (${numbers.length}/12 columns)`);
      continue;
    }
    
    // Parse the sample
    const sample = {
      t: parseInt(numbers[0], 10),
      tt: parseFloat(numbers[1]),
      ct: parseFloat(numbers[2]),
      tp: parseFloat(numbers[3]),
      cp: parseFloat(numbers[4]),
      fl: parseFloat(numbers[5]),
      tf: parseFloat(numbers[6]),
      pf: parseFloat(numbers[7]),
      vf: parseFloat(numbers[8]),
      v: parseFloat(numbers[9]),
      ev: parseFloat(numbers[10]),
      pr: parseFloat(numbers[11]),
    };
    
    // Validate that essential fields are valid numbers
    if (isNaN(sample.t)) {
      console.warn(`Skipping sample with invalid time: "${lines[i]}"`);
      continue;
    }
    
    // Track valid volume values (prefer bluetooth weight 'v', fall back to estimated 'ev')
    let currentVolume = sample.v;
    
    // Never take estimated volume (until fixed)
    //if (isNaN(currentVolume) || currentVolume <= 0) {
    //  currentVolume = sample.ev;
    //}
    
    if (!isNaN(currentVolume) && currentVolume > 0) {
      lastValidVolume = currentVolume;
      maxVolume = Math.max(maxVolume, currentVolume);
    }
    
    data['samples'].push(sample);
  }

  if (data['samples'] && data['samples'].length > 0) {
    const lastSample = data['samples'][data['samples'].length - 1];
    data.duration = lastSample.t;
let finalVolume = maxVolume > 0 ? maxVolume : lastValidVolume;
    
    // If we still don't have a valid volume, try the last sample's volume
    if (finalVolume <= 0 && !isNaN(lastSample.v) && lastSample.v > 0) {
      finalVolume = lastSample.v;
    } else if (finalVolume <= 0 && !isNaN(lastSample.ev) && lastSample.ev > 0) {
      finalVolume = lastSample.ev;
    }
    
    data.volume = finalVolume > 0 ? parseFloat(finalVolume.toFixed(1)) : null;
  }

  if (shot.notes) {
    data.notes = shot.notes;
  }

  return data;
}