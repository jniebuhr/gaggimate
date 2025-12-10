import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useState } from 'preact/hooks';

export function ConfirmButton({ onAction, icon, tooltip, confirmTooltip }) {
  const [confirm, setConfirm] = useState(false);
  const confirmOrAction = useCallback(() => {
    if (confirm) {
      onAction();
      setConfirm(false);
    } else {
      setConfirm(true);
    }
  }, [confirm, setConfirm, onAction]);

  return (
    <div className='tooltip tooltip-left' data-tip={confirm ? confirmTooltip : tooltip}>
      <button
        onClick={() => {
          confirmOrAction();
        }}
        className={`btn btn-ghost btn-sm text-error cursor-pointer transition-colors ${confirm ? 'bg-error text-error-content font-semibold' : 'hover:text-error hover:bg-error/10'}`}
        aria-label={confirm ? confirmTooltip : tooltip}
        title={confirm ? confirmTooltip : tooltip}
      >
        <FontAwesomeIcon icon={icon} />
        {confirm && <span className='ml-2 hidden sm:inline'>Confirm</span>}
      </button>
    </div>
  );
}
