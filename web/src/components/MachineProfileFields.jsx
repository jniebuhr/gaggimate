import { useState } from 'preact/hooks';
import { Trans } from '@lingui/react/macro';
import {
  PROFILE_FIELDS,
  profileSupported,
  isProfileFieldLocked,
} from '../utils/machineProfiles.js';

const LIGHT_FIELDS = [
  'systemLedFunction',
  'baristaLedFunction',
  'systemLedBrightness',
  'baristaLedBrightness',
  'systemLedMinBrightness',
  'baristaLedMinBrightness',
  'systemLedCycleTimeMs',
  'baristaLedCycleTimeMs',
];

const RESISTANCE_FIELDS = [
  'ntcBrewNominalResistance',
  'ntcBrewSeriesResistance',
  'ntcSteamNominalResistance',
  'ntcSteamSeriesResistance',
];

function ResistanceControl({ value, field, presets, disabled, onChange }) {
  const [custom, setCustom] = useState(false);
  const showCustom = custom || !presets.includes(value);
  return (
    <div className='form-control'>
      <label>
        <span className='label'>{field.label.replace('(Ω)', '(kΩ)')}</span>
        <select
          className='select select-bordered w-full'
          value={showCustom ? 'custom' : value}
          disabled={disabled}
          onChange={event => {
            const selected = event.currentTarget.value;
            setCustom(selected === 'custom');
            if (selected !== 'custom') onChange(Number(selected));
          }}
        >
          {presets.map(resistance => (
            <option key={resistance} value={resistance}>
              {resistance / 1000} kΩ
            </option>
          ))}
          <option value='custom'>
            <Trans>Custom</Trans>
          </option>
        </select>
      </label>
      {showCustom && (
        <label className='mt-2'>
          <span className='label'>
            <Trans>Custom resistance (kΩ)</Trans>
          </span>
          <input
            type='number'
            className='input input-bordered w-full'
            value={value === undefined ? '' : value / 1000}
            min={String(field.min / 1000)}
            max={String(field.max / 1000)}
            step='any'
            disabled={disabled}
            onChange={event =>
              onChange(
                event.currentTarget.value === ''
                  ? undefined
                  : Number(event.currentTarget.value) * 1000,
              )
            }
          />
        </label>
      )}
    </div>
  );
}

export function MachineProfileFields({ formData, setFields, hardwareOnly = false }) {
  const caps = formData.machineProfileCapabilities || {};
  const inHardwareSection = (key, field) => field.hardware || key === 'heaterHandoverMs';
  const fields = Object.entries(PROFILE_FIELDS).filter(
    ([key, field]) =>
      (!hardwareOnly || inHardwareSection(key, field)) &&
      !(key === 'targetWaterTemp' && caps.dualBoiler) &&
      profileSupported(key, caps, true) &&
      (formData[key] !== undefined || field.hardware),
  );
  const hardware = fields.filter(([key, field]) => inHardwareSection(key, field));
  const ordinary = fields.filter(([key, field]) => !inHardwareSection(key, field));
  const toggles = hardware.filter(([, field]) => field.type === 'boolean');
  const defaults = hardware.filter(([key]) => key === 'defaultSteamMode');
  const lights = hardware.filter(
    ([key]) => key === 'systemLedFunction' || key === 'baristaLedFunction',
  );
  const advanced = hardware.filter(
    ([key, field]) =>
      field.type !== 'boolean' && !LIGHT_FIELDS.includes(key) && key !== 'defaultSteamMode',
  );

  const renderField = ([key, field]) => {
    const supported = profileSupported(key, caps, !!formData.machineHardwareConfiguration);
    const disabled = isProfileFieldLocked(formData, key) || !supported;
    if (RESISTANCE_FIELDS.includes(key)) {
      return (
        <ResistanceControl
          key={`${key}:${formData.machineProfileSelection || 'custom'}`}
          value={formData[key]}
          field={field}
          presets={key.includes('Nominal') ? [10000, 25000, 50000, 100000] : [10000, 1000]}
          disabled={disabled}
          onChange={value => setFields({ [key]: value })}
        />
      );
    }
    if (field.type === 'boolean') {
      return (
        <label key={key} className='label cursor-pointer justify-start gap-3'>
          <input
            type='checkbox'
            className='toggle toggle-primary shrink-0'
            checked={!!formData[key]}
            disabled={disabled}
            onChange={event => setFields({ [key]: event.currentTarget.checked })}
          />
          <span className='text-wrap'>{field.label}</span>
        </label>
      );
    }
    return (
      <label className='form-control' key={key}>
        <span className='label'>{field.label}</span>
        {field.options ? (
          <select
            className='select select-bordered w-full'
            value={formData[key]}
            disabled={disabled}
            onChange={event => setFields({ [key]: Number(event.currentTarget.value) })}
          >
            {(field.values
              ? field.values.map(value => [value, field.options[value]])
              : Object.entries(field.options)
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === 'csv' ? 'text' : 'number'}
            className='input input-bordered w-full'
            value={key === 'pid' ? `${formData.pid},${formData.kf}` : (formData[key] ?? '')}
            min={field.min}
            max={field.max}
            step={field.type === 'integer' ? 1 : 'any'}
            disabled={disabled}
            onChange={event => {
              const value = event.currentTarget.value;
              if (key === 'pid') {
                const parts = value.split(',');
                setFields({ pid: parts.slice(0, 3).join(','), kf: parts[3] ?? '0' });
              } else {
                setFields({
                  [key]: field.type === 'csv' ? value : value === '' ? undefined : Number(value),
                });
              }
            }}
          />
        )}
      </label>
    );
  };

  return (
    <div className='space-y-4'>
      {ordinary.length > 0 && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>{ordinary.map(renderField)}</div>
      )}
      {hardware.length > 0 && (
        <div className='space-y-4'>
          {!hardwareOnly && (
            <h3 className='font-medium'>
              <Trans>Dual Boiler Hardware</Trans>
            </h3>
          )}
          <p className='text-sm opacity-70'>
            <Trans>Requires controller restart.</Trans>
          </p>
          {!formData.machineHardwareConfiguration && (
            <p className='text-sm opacity-70'>
              <Trans>Requires hardware configuration support.</Trans>
            </p>
          )}
          <div className='flex flex-col gap-2'>{toggles.map(renderField)}</div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {lights.map(([key, field]) => {
              const brightnessKey = key.replace('Function', 'Brightness');
              const brightness = formData[brightnessKey] ?? 255;
              const minimumKey = key.replace('Function', 'MinBrightness');
              const cycleKey = key.replace('Function', 'CycleTimeMs');
              const minimum = Math.min(formData[minimumKey] ?? 0, brightness);
              const animated = [1, 2, 5, 6].includes(Number(formData[key]));
              return (
                <div key={key} className='space-y-2'>
                  {renderField([key, field])}
                  <label className='form-control block pt-2'>
                    <span className='label'>
                      <Trans>Max brightness</Trans> ({Math.round((brightness * 100) / 255)}%)
                    </span>
                    <input
                      type='range'
                      className='range range-primary w-full'
                      min='0'
                      max='255'
                      step={1}
                      value={brightness}
                      disabled={
                        Number(formData[key]) === 0 || isProfileFieldLocked(formData, brightnessKey)
                      }
                      onInput={event => {
                        const value = Number(event.currentTarget.value);
                        setFields({
                          [brightnessKey]: value,
                          [minimumKey]: Math.min(minimum, value),
                        });
                      }}
                    />
                  </label>
                  {animated && (
                    <>
                      <label className='form-control block pt-2'>
                        <span className='label'>
                          <Trans>Min brightness</Trans> ({Math.round((minimum * 100) / 255)}%)
                        </span>
                        <input
                          type='range'
                          className='range range-primary w-full'
                          min='0'
                          max='255'
                          step={1}
                          value={minimum}
                          disabled={isProfileFieldLocked(formData, minimumKey)}
                          onInput={event =>
                            setFields({
                              [minimumKey]: Math.min(Number(event.currentTarget.value), brightness),
                            })
                          }
                        />
                      </label>
                      <label className='form-control block pt-2'>
                        <span className='label'>
                          <Trans>Cycle time (seconds)</Trans>
                        </span>
                        <input
                          type='number'
                          className='input input-bordered w-full'
                          min='0.5'
                          max='10'
                          step={0.1}
                          value={(formData[cycleKey] ?? 3000) / 1000}
                          disabled={isProfileFieldLocked(formData, cycleKey)}
                          onChange={event =>
                            setFields({
                              [cycleKey]: Math.round(Number(event.currentTarget.value) * 1000),
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {defaults.length > 0 && (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>{defaults.map(renderField)}</div>
          )}
          <details className='border-base-content/10 border-t pt-3'>
            <summary className='cursor-pointer font-medium'>
              <Trans>Advanced hardware settings</Trans>
            </summary>
            <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              {advanced.map(renderField)}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
