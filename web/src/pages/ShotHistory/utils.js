export function parseHistoryData(shot) {
  const data = {
    id: shot.id,
  };
  const lines = shot.history.split('\n');
  const header = lines[0].split(',');
  data['version'] = header[0];
  data['profile'] = header[1];
  data['timestamp'] = parseInt(header[2]);
  data['samples'] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) {
      continue;
    }
    const numbers = lines[i].split(',');
    data['samples'].push({
      t: parseInt(numbers[0]),
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
    });
  }

  if (data['samples']) {
    const lastSample = data['samples'][data['samples'].length - 1];
    data.duration = lastSample.t;
    data.volume = lastSample.v;
  }
  return data;
}
