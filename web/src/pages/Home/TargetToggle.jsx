import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';

const TargetToggle = ({ value, onChange }) => {
  const pill = on =>
    `flex flex-row cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 py-1 text-xs transition-all duration-200 px-8 ${on ? 'bg-primary text-primary-content font-medium' : 'text-base-content/60 hover:text-base-content'}`;
  return (
    <div className='bg-base-200/70 flex min-w-0 rounded-full p-1'>
      <button className={pill(value === 0)} onClick={() => onChange(0)}>
        <FontAwesomeIcon icon={faClock} className='text-[0.65rem]' /> <span>Time</span>
      </button>
      <button className={pill(value === 1)} onClick={() => onChange(1)}>
        <FontAwesomeIcon icon={faWeightScale} className='text-[0.65rem]' /> <span>Weight</span>
      </button>
    </div>
  );
};

export default TargetToggle;
