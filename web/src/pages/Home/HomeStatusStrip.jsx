import { computed } from '@preact/signals';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons/faPlugCircleBolt';
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faTemperatureHigh } from '@fortawesome/free-solid-svg-icons/faTemperatureHigh';
import { faBookmark } from '@fortawesome/free-solid-svg-icons/faBookmark';
import { machine } from '../../services/ApiService.js';

const status = computed(() => machine.value.status);

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];

function formatReading(value, suffix) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}${suffix}`;
}

function MobilePill({ icon, label, toneClass, value }) {
  return (
    <div className={`home-mobile-pill ${toneClass}`}>
      <div className='flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] opacity-72'>
        <FontAwesomeIcon icon={icon} />
        <span>{label}</span>
      </div>
      <div className='mt-2 truncate text-sm font-semibold leading-tight'>{value}</div>
    </div>
  );
}

export default function HomeStatusStrip() {
  const currentMode = MODE_LABELS[status.value.mode] || 'Standby';
  const temp = formatReading(status.value.currentTemperature, 'C');
  const pressure = formatReading(status.value.currentPressure, ' bar');

  return (
    <div className='grid grid-cols-2 gap-3 lg:hidden'>
      <MobilePill
        icon={faPlugCircleBolt}
        label='Connection'
        toneClass='home-mobile-pill-success'
        value={machine.value.connected ? 'Online' : 'Offline'}
      />
      <MobilePill icon={faSliders} label='Mode' toneClass='home-mobile-pill-warning' value={currentMode} />
      <MobilePill
        icon={faBookmark}
        label='Profile'
        toneClass='home-mobile-pill-info'
        value={status.value.selectedProfile || 'Default'}
      />
      <MobilePill
        icon={faLeaf}
        label='Bean'
        toneClass='home-mobile-pill-secondary'
        value={status.value.selectedBean || 'Not selected'}
      />
      <div className='col-span-2'>
        <MobilePill
          icon={faTemperatureHigh}
          label='Temp / Pressure'
          toneClass='home-mobile-pill-error'
          value={`${temp} / ${pressure}`}
        />
      </div>
    </div>
  );
}
