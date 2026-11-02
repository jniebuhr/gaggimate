import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

const Adjuster = ({ label, value, onDecrease, onIncrease }) => {
  const btn = 'btn btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-full p-0';
  return (
    <div className='flex flex-col items-center gap-1'>
      <div className='text-base-content/60 text-[0.65rem] font-light tracking-wider'>{label}</div>
      <div className='flex items-center space-x-2'>
        <button onClick={onDecrease} className={btn}>
          <FontAwesomeIcon icon={faMinus} className='h-3 w-3' />
        </button>
        <div className='text-base-content min-w-[72px] text-center text-lg font-bold tabular-nums'>
          {value}
        </div>
        <button onClick={onIncrease} className={btn}>
          <FontAwesomeIcon icon={faPlus} className='h-3 w-3' />
        </button>
      </div>
    </div>
  );
};

export default Adjuster;
