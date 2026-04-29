import { computed } from '@preact/signals';
import { machine } from '../../services/ApiService.js';

const status = computed(() => machine.value.status);

const MODE_LABELS = ['STANDBY', 'BREW', 'STEAM', 'WATER', 'GRIND'];

function formatReading(value, suffix) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}${suffix}`;
}

// Minimal mobile strip — nd-stat pills, monochrome
export default function HomeStatusStrip() {
  const currentMode = MODE_LABELS[status.value.mode] || 'STANDBY';
  const temp = formatReading(status.value.currentTemperature, '°C');
  const pressure = formatReading(status.value.currentPressure, ' bar');
  const connected = machine.value.connected;

  return (
    <div className='grid grid-cols-2 gap-3 lg:hidden'>
      <div className='nd-stat'>
        <div className='nd-stat-label'>
          <span className={`nd-status-dot mr-2 inline-block align-middle ${connected ? 'nd-status-dot--online' : ''}`} />
          Connection
        </div>
        <div className='nd-stat-value'>{connected ? 'Online' : 'Offline'}</div>
      </div>
      <div className='nd-stat'>
        <div className='nd-stat-label'>Mode</div>
        <div className={`nd-stat-value ${status.value.mode === 1 ? 'nd-stat-value--accent' : ''}`}>
          {currentMode}
        </div>
      </div>
      <div className='nd-stat'>
        <div className='nd-stat-label'>Profile</div>
        <div className='nd-stat-value'>{status.value.selectedProfile || 'Default'}</div>
      </div>
      <div className='nd-stat'>
        <div className='nd-stat-label'>Bean</div>
        <div className='nd-stat-value'>{status.value.selectedBean || 'Not selected'}</div>
      </div>
      <div className='col-span-2 nd-stat'>
        <div className='nd-stat-label'>Temp / Pressure</div>
        <div className='nd-stat-value'>{temp} / {pressure}</div>
      </div>
    </div>
  );
}