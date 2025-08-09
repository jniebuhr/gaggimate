import { computed } from '@preact/signals';
import { machine } from '../services/ApiService.js';

const processInfo = computed(() => machine.value.status.process);

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function ProcessInfo() {
  const info = processInfo.value;

  if (!info || !info.step) {
    return null;
  }

  const target =
    info.targetType === 'time' ? formatTime(info.targetValue || 0) : `${info.targetValue || 0}g`;

  const progress =
    info.phaseTarget > 0
      ? Math.min(100, Math.floor((info.phaseProgress / info.phaseTarget) * 100))
      : 0;

  return (
    <div className='flex flex-col gap-2'>
      <div className='text-xl font-bold'>{info.step.toUpperCase()}</div>
      <div className='text-sm opacity-70'>{info.phase}</div>
      <div className='text-sm'>
        {formatTime(info.elapsed)} / {target}
      </div>
      <progress className='progress progress-primary w-full' value={progress} max='100' />
    </div>
  );
}
