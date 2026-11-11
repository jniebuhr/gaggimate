import { saveSmartDoseSetting, smartDoseModes } from '../../utils/smartDoseSettings.js';
import { useContext, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import SmartDoseModeSelector from '../../components/SmartDoseModeSelector.jsx';
import { ApiServiceContext, machine, getCachedSettings } from '../../services/ApiService.js';

const EXPANSION_KEY = 'smartDoseAccessoryExpansion';
function initialExpansion() {
  try {
    return {
      cup: true,
      portafilter: true,
      ...JSON.parse(localStorage.getItem(EXPANSION_KEY) || '{}'),
    };
  } catch {
    return { cup: true, portafilter: true };
  }
}

export default function SmartDoseSettings({ formData, onSaved, onSaving, disabled = false }) {
  const api = useContext(ApiServiceContext);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [calibrating, setCalibrating] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [expanded, setExpanded] = useState(initialExpansion);
  const hardwareSupported = !!machine.value.capabilities.hardwareScale;
  const modes = smartDoseModes(formData, hardwareSupported);
  const changeExpansion = (accessory, value) => {
    setExpanded(previous => {
      const next = { ...previous, [accessory]: value };
      try {
        localStorage.setItem(EXPANSION_KEY, JSON.stringify(next));
      } catch {
        /* Storage may be unavailable. */
      }
      return next;
    });
  };
  const saveValue = async (key, value) => {
    setBusy(true);
    onSaving(true);
    try {
      const settings = await saveSmartDoseSetting(key, value);
      onSaved(key, settings[key], settings);
      if (key === 'dosingCupEnabled' || key === 'portafilterEnabled')
        changeExpansion(key === 'dosingCupEnabled' ? 'cup' : 'portafilter', value);
      setMessage(key === 'smartDoseActive' ? 'Saved. Restart to apply.' : 'Saved automatically.');
    } catch {
      setMessage('Could not save. Check the connection and try again.');
    } finally {
      setBusy(false);
      onSaving(false);
    }
  };
  const save = key => e =>
    saveValue(
      key,
      e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value,
    );
  const calibrate = async accessory => {
    setBusy(true);
    setCalibrating(accessory);
    onSaving(true);
    setFeedback(previous => ({ ...previous, [accessory]: null }));
    try {
      const res = await api.request({ tp: 'req:smart-dose:calibrate', accessory });
      if (!res.ok)
        throw new Error(
          'Use idle brew mode with Automagic off. Wait for a stable, positive weight on the selected scale.',
        );
      const key = accessory === 'cup' ? 'dosingCupWeight' : 'portafilterWeight';
      // The response already contains the persisted calibration. Reflect it
      // immediately; a subsequent settings refresh is not required to show success.
      const value = accessory === 'cup' ? res.smartDose.cupWeight : res.smartDose.portafilterWeight;
      onSaved(key, value, { ...(getCachedSettings() || {}), [key]: value });
      setFeedback(previous => ({
        ...previous,
        [accessory]: { ok: true, text: `Weight saved: ${value.toFixed(1)} g` },
      }));
    } catch (error) {
      setFeedback(previous => ({
        ...previous,
        [accessory]: {
          ok: false,
          text: error.message || 'Could not save weight. Check the connection and try again.',
        },
      }));
    } finally {
      setBusy(false);
      setCalibrating(null);
      onSaving(false);
    }
  };
  return (
    <section className='bg-base-200 rounded-lg p-4' aria-label='Smart Dosing settings'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-xl font-medium'>Smart Dosing</h3>
        <input
          type='checkbox'
          className='toggle toggle-primary'
          checked={!!formData.smartDoseActive}
          onChange={save('smartDoseActive')}
          disabled={busy || disabled}
          aria-label='Enable Smart Dosing'
        />
      </div>
      {formData.smartDoseActive && (
        <div className='border-base-300 mt-3 space-y-4 border-t pt-3'>
          {hardwareSupported && (
            <label className='flex flex-wrap items-center justify-between gap-2 text-sm'>
              <span className='font-medium'>Manual Dosing Scale</span>
              <select
                className='select select-bordered select-sm min-h-11 w-36 max-w-full'
                value={formData.manualDoseScale || 'bluetooth'}
                onChange={save('manualDoseScale')}
                disabled={busy || disabled}
                aria-label='Manual Dosing Scale'
              >
                <option value='bluetooth'>Bluetooth</option>
                <option value='hardware'>Hardware</option>
              </select>
            </label>
          )}
          <label className='flex items-center justify-between gap-4'>
            <div>
              <span className='font-medium'>Automagic</span>
              <p className='mt-1 max-w-lg text-sm opacity-70'>
                Automatically measure and record coffee doses using a calibrated dosing cup or
                portafilter.
              </p>
            </div>
            <input
              type='checkbox'
              className='toggle toggle-primary shrink-0'
              checked={!!formData.smartDoseAutomagic}
              onChange={save('smartDoseAutomagic')}
              disabled={busy || disabled}
            />
          </label>
          <div>
            <div className='mb-2 flex items-center gap-2'>
              <span className='text-sm font-medium'>Operating mode</span>
            </div>
            <SmartDoseModeSelector
              {...modes}
              disabled={busy || disabled}
              onChange={value => saveValue('smartDoseMode', value)}
            />
            <p className='mt-1 text-xs opacity-70'>
              {modes.automaticAvailable
                ? 'Automatic detection available'
                : modes.cupConfigured && modes.portafilterConfigured
                  ? 'Auto unavailable — shared-scale accessory weights cannot be distinguished safely.'
                  : 'Enable and calibrate both accessories to use Auto.'}
            </p>
          </div>
          {formData.smartDoseAutomagic && (
            <div className='alert alert-warning gap-2 py-3 text-sm' role='note'>
              <FontAwesomeIcon icon={faTriangleExclamation} className='h-4 w-4 shrink-0' />
              <div>
                <strong>Disable Automagic before calibrating</strong>
                <p className='mt-1 text-xs'>
                  Turn off Automagic before placing an accessory on the scale to prevent starting a
                  dosing cycle.
                </p>
              </div>
            </div>
          )}
          <div className='grid items-start gap-3 lg:grid-cols-2'>
            {['cup', 'portafilter'].map(accessory => {
              const cup = accessory === 'cup';
              const name = cup ? 'Dosing Cup' : 'Portafilter';
              const enabledKey = cup ? 'dosingCupEnabled' : 'portafilterEnabled';
              const scaleKey = cup ? 'smartDoseScale' : 'portafilterScale';
              const enabled = formData[enabledKey] ?? true;
              const open = enabled && expanded[accessory];
              const scale = hardwareSupported ? formData[scaleKey] || 'bluetooth' : 'bluetooth';
              const weight = Number(formData[cup ? 'dosingCupWeight' : 'portafilterWeight'] || 0);
              const result = feedback[accessory];
              return (
                <section
                  key={accessory}
                  className={`border-base-300 bg-base-100 min-w-0 rounded-lg border ${enabled ? '' : 'opacity-60'}`}
                  aria-label={`${name} configuration`}
                >
                  <div className='flex items-center gap-3 p-3'>
                    <button
                      type='button'
                      className='flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left'
                      disabled={!enabled}
                      aria-expanded={!!open}
                      aria-controls={`smart-dose-${accessory}`}
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
                      onClick={() => changeExpansion(accessory, !open)}
                    >
                      <span className='min-w-0'>
                        <span className='block font-medium'>{name}</span>
                        <span className='block text-xs opacity-70'>
                          {!enabled ? 'Disabled · ' : ''}
                          {weight > 0 ? `${weight.toFixed(1)} g` : 'Not calibrated'} ·{' '}
                          {scale === 'hardware' ? 'Hardware' : 'Bluetooth'}
                        </span>
                      </span>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <label className='flex min-h-11 min-w-11 items-center justify-center'>
                      <input
                        type='checkbox'
                        className='toggle toggle-primary toggle-sm shrink-0'
                        checked={enabled}
                        onChange={save(enabledKey)}
                        disabled={busy || disabled}
                        aria-label={`Enable ${name}`}
                      />
                    </label>
                  </div>
                  {open && (
                    <div
                      id={`smart-dose-${accessory}`}
                      className='border-base-300 space-y-3 border-t p-3'
                    >
                      {hardwareSupported && (
                        <label className='flex flex-wrap items-center justify-between gap-2 text-sm'>
                          <span>Scale</span>
                          <select
                            className='select select-bordered select-sm min-h-11 w-36 max-w-full'
                            value={scale}
                            onChange={save(scaleKey)}
                            disabled={busy || disabled}
                            aria-label={`${name} scale`}
                          >
                            <option value='bluetooth'>Bluetooth</option>
                            <option
                              value='hardware'
                              disabled={!machine.value.capabilities.hardwareScale}
                            >
                              Hardware
                            </option>
                          </select>
                        </label>
                      )}
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                          <span className='block text-xs opacity-70'>Calibrated weight</span>
                          <strong className='text-sm tabular-nums'>
                            {weight > 0 ? `${weight.toFixed(1)} g` : 'Not calibrated'}
                          </strong>
                        </div>
                        <button
                          type='button'
                          className='btn btn-primary btn-sm min-h-11'
                          disabled={
                            busy ||
                            disabled ||
                            !!formData.smartDoseAutomagic ||
                            !formData.smartDoseActive
                          }
                          onClick={() => calibrate(accessory)}
                        >
                          {calibrating === accessory ? 'Saving…' : 'Save Weight'}
                        </button>
                      </div>
                      <p className='text-xs opacity-70'>
                        {cup
                          ? 'Tare the empty scale, then place the empty dosing cup on it.'
                          : 'Tare the empty scale, then place the portafilter with its basket and any accessories that remain attached when weighing.'}
                      </p>
                      <p className='text-xs opacity-70'>
                        Save a stable weight while idle in brew mode.
                      </p>
                      {result && (
                        <p
                          role={result.ok ? 'status' : 'alert'}
                          className={`text-xs ${result.ok ? 'text-success' : 'text-error'}`}
                        >
                          {result.text}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          {message && (
            <p role='status' className='text-xs opacity-70'>
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
