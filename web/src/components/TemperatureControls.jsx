import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { Tooltip } from './Tooltip.jsx';

export function TemperatureControls({ targetTemperature, onLower, onRaise }) {
  return (
    <div className='flex flex-col items-center gap-2'>
      <div className='text-base-content/60 text-xs font-light tracking-wider'>TEMPERATURE</div>
      <div className='flex items-center space-x-2'>
        <Tooltip content='Lower temperature'>
          <button
            onClick={onLower}
            className='btn btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-full p-0'
          >
            <FontAwesomeIcon icon={faMinus} className='h-3 w-3' />
          </button>
        </Tooltip>
        <div className='text-base-content min-w-[80px] text-center text-lg font-bold'>
          {targetTemperature}°C
        </div>
        <Tooltip content='Raise temperature'>
          <button
            onClick={onRaise}
            className='btn btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-full p-0'
          >
            <FontAwesomeIcon icon={faPlus} className='h-3 w-3' />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

TemperatureControls.propTypes = {
  targetTemperature: PropTypes.number.isRequired,
  onLower: PropTypes.func.isRequired,
  onRaise: PropTypes.func.isRequired,
};
