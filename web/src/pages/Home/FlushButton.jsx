import PropTypes from 'prop-types';
import { useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';

// Press-and-hold aware: a hold-to-flush (flush duration 0) runs until the pointer or key is released.
export function FlushButton({ className, isFlushing, startFlush, stopFlush }) {
  // The release is caught on the window so it still arrives when the pointer left the button.
  useEffect(() => {
    if (!isFlushing) return undefined;
    window.addEventListener('pointerup', stopFlush);
    window.addEventListener('pointercancel', stopFlush);
    return () => {
      window.removeEventListener('pointerup', stopFlush);
      window.removeEventListener('pointercancel', stopFlush);
    };
  }, [isFlushing, stopFlush]);

  const onKeyDown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      startFlush();
    }
  };
  const onKeyUp = e => {
    if (e.key === 'Enter' || e.key === ' ') stopFlush();
  };
  return (
    <button
      type='button'
      className={`${className} ${isFlushing ? 'btn-active' : ''}`}
      onPointerDown={startFlush}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      aria-pressed={isFlushing}
      aria-label='Flush water'
    >
      <FontAwesomeIcon icon={faTint} /> Flush
    </button>
  );
}

FlushButton.propTypes = {
  className: PropTypes.string.isRequired,
  isFlushing: PropTypes.bool.isRequired,
  startFlush: PropTypes.func.isRequired,
  stopFlush: PropTypes.func.isRequired,
};
