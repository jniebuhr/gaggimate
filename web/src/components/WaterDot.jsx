import { machine } from '../services/ApiService.js';

export function WaterDot({ className = '' }) {
  const state = machine.value;
  if (!state.capabilities.tof) return null;

  const wl = state.status.waterLevel;
  if (wl < 0) return null;

  const ok = wl >= 20;
  const color = ok ? state.status.sunriseIdle || '#00FFFF' : state.status.sunriseError || '#FF0000';

  return (
    <div
      className={className}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color,
        border: '1px solid rgba(128,128,128,0.5)',
        display: 'inline-block',
        flexShrink: 0,
      }}
      title={`Water level: ${wl}%`}
    />
  );
}
