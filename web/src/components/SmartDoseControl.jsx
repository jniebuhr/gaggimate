import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { useContext, useState } from 'preact/hooks';
import PropTypes from 'prop-types';
import SmartDoseModeSelector from './SmartDoseModeSelector.jsx';
import SmartDoseMeasurement from './SmartDoseMeasurement.jsx';
import { saveSmartDoseSetting } from '../utils/smartDoseSettings.js';
import { ApiServiceContext, updateSettingsCache } from '../services/ApiService.js';

export default function SmartDoseControl({ dose, inCard = false }) {
  const api = useContext(ApiServiceContext);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!dose?.enabled) return null;
  const capture = async () => {
    setBusy(true);
    try {
      const res = await api.request({ tp: 'req:smart-dose:set' });
      setError(res.ok ? '' : 'Weight changed. Wait for a stable dose and try again.');
    } catch {
      setError('Could not set dose. Check the connection.');
    } finally {
      setBusy(false);
    }
  };
  const adjust = async direction => {
    setBusy(true);
    setError('');
    try {
      const res = await api.request({ tp: 'req:smart-dose:adjust', direction });
      if (!res.ok) setError('Dose can be adjusted from 5 to 40 g while idle in brew mode.');
    } catch {
      setError('Could not adjust dose. Check the connection.');
    } finally {
      setBusy(false);
    }
  };
  const chooseMode = async mode => {
    setBusy(true);
    try {
      updateSettingsCache(await saveSmartDoseSetting('smartDoseMode', mode));
      setError('');
    } catch {
      setError('Could not change dosing mode.');
    } finally {
      setBusy(false);
    }
  };
  const owner = dose.owner || 'none';
  const active = owner !== 'none';
  const cup = dose.cupConfigured ? dose.cup : null;
  const portafilter = dose.portafilterConfigured ? dose.portafilter : null;
  let measurements;
  if (cup && portafilter && cup.source !== portafilter.source) {
    measurements = [
      ['cup', cup],
      ['portafilter', portafilter],
    ];
  } else if (cup && portafilter) {
    const accessory = active ? owner : dose.mode === 'automatic' ? 'shared' : dose.mode;
    measurements = [
      [
        accessory,
        accessory === 'portafilter'
          ? portafilter
          : { ...cup, portafilterCalibration: portafilter.calibration },
      ],
    ];
  } else if (portafilter) {
    measurements = [['portafilter', portafilter]];
  } else {
    measurements = cup ? [['cup', cup]] : [['manual', dose.manual]];
  }
  if (
    dose.manual &&
    !measurements.some(([, measurement]) => measurement?.source === dose.manualSource)
  ) {
    measurements.push(['manual', dose.manual]);
  }
  const cycleStatus =
    dose.phase === 'taring'
      ? 'Taring dosing cup…'
      : dose.phase === 'removing'
        ? 'Recording dose…'
        : owner === 'cup'
          ? 'Dosing cup — Filling'
          : `Portafilter — ${dose.stable ? 'Dose ready' : 'Measuring'}`;
  const status = active
    ? cycleStatus
    : dose.available
      ? 'Accept dose'
      : !measurements.some(([, m]) => m?.connected)
        ? 'Scale unavailable'
        : !dose.automagic
          ? 'Manual dosing'
          : 'Ready to measure';
  return (
    <div
      className={
        inCard
          ? '@container flex flex-col gap-3'
          : 'card bg-base-100 @container flex flex-col gap-3 rounded-xl p-3'
      }
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
          Smart Dosing
        </div>
        {dose.automagic && (
          <span
            className={`rounded-full px-2 py-0.5 text-[0.65rem] ${active ? 'bg-primary/10 text-primary motion-safe:animate-pulse' : 'bg-base-200 text-base-content/60'}`}
          >
            {active ? 'Automagic active' : 'Automagic enabled'}
          </span>
        )}
      </div>
      {dose.cupConfigured && dose.portafilterConfigured && !dose.automaticAvailable && (
        <SmartDoseModeSelector
          mode={dose.mode}
          cupConfigured={dose.cupConfigured}
          portafilterConfigured={dose.portafilterConfigured}
          automaticAvailable={dose.automaticAvailable}
          disabled={busy}
          onChange={chooseMode}
        />
      )}
      {dose.automagic && !dose.cupConfigured && !dose.portafilterConfigured && (
        <p className='text-sm'>Calibrate an accessory to use Automagic.</p>
      )}
      <div
        className={`grid gap-2 ${measurements.length === 2 ? '@min-[360px]:grid-cols-2' : 'grid-cols-1'}`}
      >
        {measurements.map(([accessory, measurement]) => (
          <SmartDoseMeasurement
            key={accessory}
            accessory={accessory}
            measurement={measurement}
            active={owner === accessory}
            phase={dose.phase}
            // @ts-expect-error SmartDoseMeasurement has no automagic prop; it is ignored
            automagic={dose.automagic}
          />
        ))}
      </div>
      <div className='border-base-content/10 border-t pt-3'>
        <div className='flex flex-col items-center gap-1'>
          <div className='flex w-full items-center justify-between'>
            <button
              type='button'
              className='btn btn-ghost btn-sm flex min-h-11 min-w-11 items-center justify-center rounded-full p-0'
              aria-label='Decrease dose by half a gram'
              onClick={() => adjust(-1)}
              disabled={busy || !dose.adjustable || dose.doseIn === 5}
            >
              <FontAwesomeIcon icon={faMinus} className='h-2.5 w-2.5' />
            </button>
            <strong className='flex-1 text-center text-lg tabular-nums'>
              {dose.doseIn > 0 ? `${dose.doseIn.toFixed(1)} g` : '—'}
            </strong>
            <button
              type='button'
              className='btn btn-ghost btn-sm flex min-h-11 min-w-11 items-center justify-center rounded-full p-0'
              aria-label='Increase dose by half a gram'
              onClick={() => adjust(1)}
              disabled={busy || !dose.adjustable || dose.doseIn === 40}
            >
              <FontAwesomeIcon icon={faPlus} className='h-2.5 w-2.5' />
            </button>
          </div>
          <span className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
            Current Profile Dose
          </span>
        </div>
      </div>
      <button
        type='button'
        onClick={capture}
        disabled={!dose.available || busy}
        className={`btn btn-sm h-auto min-h-11 w-full flex-col items-start justify-between gap-1 py-2 text-left @min-[360px]:flex-row @min-[360px]:items-center ${dose.available ? 'btn-primary' : 'btn-ghost bg-base-200/70 disabled:opacity-100'} ${active ? 'border-primary/30' : ''}`}
        aria-label='Accept current scale weight as dose'
      >
        <span>{busy ? 'Saving…' : status}</span>
        {active && (
          <span className='text-xs font-normal opacity-70'>
            {dose.available ? 'Tap to accept · Captures on removal' : 'Captures on removal'}
          </span>
        )}
      </button>
      {error && (
        <p role='alert' className='text-error mt-1'>
          {error}
        </p>
      )}
    </div>
  );
}

SmartDoseControl.propTypes = {
  dose: PropTypes.object,
  inCard: PropTypes.bool,
};
