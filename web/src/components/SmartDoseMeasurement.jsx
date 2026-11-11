import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMugHot } from '@fortawesome/free-solid-svg-icons/faMugHot';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';

const formatWeight = value => (Number.isFinite(value) ? `${value.toFixed(1)} g` : '—');

export default function SmartDoseMeasurement({ accessory, measurement, active, phase }) {
  const portafilter = accessory === 'portafilter';
  const shared = accessory === 'shared';
  const connected = !!measurement?.connected;
  const manual = accessory === 'manual';
  const pfCalibration = portafilter
    ? measurement?.calibration
    : measurement?.portafilterCalibration;
  const calculatedWeight = measurement?.gross - pfCalibration;
  const calculated =
    (portafilter || shared) &&
    ((active && portafilter) || (calculatedWeight >= 5 && calculatedWeight <= 40));
  let weight = calculated
    ? calculatedWeight
    : active && !portafilter && !shared
      ? measurement?.weight
      : measurement?.raw;
  const detectingCup = active && !portafilter && !shared && phase === 'taring';
  if (!connected || weight < 0 || detectingCup) weight = null;
  return (
    <section
      aria-label={
        portafilter
          ? 'Portafilter measurement'
          : shared
            ? 'Shared scale measurement'
            : manual
              ? 'Manual dosing measurement'
              : 'Dosing cup measurement'
      }
      className={`min-w-0 rounded-xl border p-3 ${active ? 'border-primary/50 bg-primary/5' : 'border-base-content/10'}`}
    >
      <div className='flex items-center justify-between gap-2 text-sm font-semibold'>
        <span className='flex items-center gap-2'>
          <FontAwesomeIcon
            className='h-4 w-4 shrink-0'
            icon={portafilter ? faScaleBalanced : shared ? faWeightScale : faMugHot}
          />
          {portafilter
            ? 'Portafilter'
            : shared
              ? 'Dosing Scale'
              : manual
                ? 'Manual Dosing'
                : 'Dosing Cup'}
        </span>
        {active && <span className='text-primary text-xs'>Active</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${calculated ? 'text-primary' : ''}`}>
        {formatWeight(weight)}
      </div>
      <div className='text-base-content/60 mt-1 text-xs'>
        {measurement?.source === 'hardware' ? 'Hardware' : 'Bluetooth'}
        {' · '}
        {!connected
          ? 'Unavailable'
          : detectingCup
            ? 'Taring…'
            : calculated
              ? 'Calculated Dose'
              : active && !portafilter && !shared
                ? 'Net Weight'
                : 'Gross Weight'}
        {measurement?.manual && !manual && ' · Manual dosing'}
      </div>
      {portafilter && (
        <dl className='border-base-content/10 text-base-content/60 mt-3 space-y-1 border-t pt-2 text-xs'>
          <div className='flex justify-between gap-2'>
            <dt>Gross weight</dt>
            <dd className='tabular-nums'>{formatWeight(connected ? measurement?.gross : null)}</dd>
          </div>
          <div className='flex justify-between gap-2'>
            <dt>Portafilter tare</dt>
            <dd className='tabular-nums'>{formatWeight(measurement?.calibration)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

SmartDoseMeasurement.propTypes = {
  accessory: PropTypes.string.isRequired,
  measurement: PropTypes.object,
  active: PropTypes.bool,
  phase: PropTypes.string,
  automagic: PropTypes.bool,
};
