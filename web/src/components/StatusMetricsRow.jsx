import PropTypes from 'prop-types';
import { computed } from '@preact/signals';
import { machine } from '../services/ApiService.js';

// Define the shape of the status object for validation
const statusShape = PropTypes.shape({
  currentTemperature: PropTypes.number,
  targetTemperature: PropTypes.number,
  currentPressure: PropTypes.number,
  targetPressure: PropTypes.number,
  currentWeight: PropTypes.number,
  targetWeight: PropTypes.number,
  volumetricAvailable: PropTypes.bool,
  brewTarget: PropTypes.bool,
});
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThermometerHalf } from '@fortawesome/free-solid-svg-icons/faThermometerHalf';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';

const status = computed(() => machine.value.status);

export function StatusMetricsRow({ mode }) {
  const { currentTemperature, targetTemperature, currentPressure, targetPressure, volumetricAvailable, brewTarget } = status.value || {};

  const brewTarget_ = !!brewTarget; // Coerce to strict boolean
  const showWeight = volumetricAvailable && (mode === 1 || mode === 3);

  return (
    <div className='mb-2 flex flex-col items-center justify-between space-y-2 sm:flex-row sm:space-y-0'>
      <div className='flex flex-row items-center gap-2 text-center text-base sm:text-left sm:text-lg'>
        <FontAwesomeIcon icon={faThermometerHalf} className='text-base-content/60' />
        <span className='text-base-content'>{(currentTemperature ?? 0).toFixed(1)}</span>
        <span className='text-success font-semibold'> / {targetTemperature || 0}°C</span>
      </div>
      {showWeight && (
        <div className='flex flex-row items-center gap-2 text-center text-base sm:text-left sm:text-lg'>
          <i className='fa fa-weight-scale text-base-content/60' />
          <span className='text-base-content'>{(status.value.currentWeight ?? 0).toFixed(1)}g</span>
          <span className='text-success font-semibold'> / {(status.value.targetWeight ?? 0).toFixed(0)}g</span>
        </div>
      )}
      <div className='flex flex-row items-center gap-2 text-center text-base sm:text-right sm:text-lg'>
        <FontAwesomeIcon icon={faGauge} className='text-base-content/60' />
        <span className='text-base-content'>
          {currentPressure?.toFixed(1) || 0} / {targetPressure?.toFixed(1) || 0} bar
        </span>
      </div>
    </div>
  );
}

StatusMetricsRow.propTypes = {
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
};

// Validate the status signal value shape at runtime
if (typeof status.value === 'object' && status.value !== null) {
  PropTypes.checkPropTypes(
    { status: statusShape },
    { status: status.value },
    'prop',
    'StatusMetricsRow (status signal)'
  );
}
