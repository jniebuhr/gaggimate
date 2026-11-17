import PropTypes from 'prop-types';
import { useEffect, useRef } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { Trans, useLingui } from '@lingui/react/macro';

const TOUCH_HOLD_MS = 400;
const TOUCH_MOVE_PX = 10;

// A fixed-length flush starts like a regular button, on click (release). A hold-to-flush (flush duration 0)
// starts on press and runs until the pointer or key is released.
export function FlushButton({ className, isFlushing, isHoldFlush, startFlush, stopFlush }) {
  const { t } = useLingui();
  const latest = useRef({});
  latest.current = { startFlush, stopFlush };
  const cleanup = useRef(null);
  useEffect(() => () => cleanup.current?.(), []);

  const onClick = () => {
    if (!isHoldFlush) startFlush();
  };
  const onPointerDown = e => {
    // Only the contact that started the interaction can end it; further presses meanwhile are ignored.
    if (!isHoldFlush || cleanup.current) return;
    const { pointerId } = e;
    if (e.pointerType !== 'touch') {
      startFlush();
      // The release is caught on the window so it still arrives when the pointer left the button.
      const end = ev => {
        if (ev.pointerId !== pointerId) return;
        cleanup.current?.();
        latest.current.stopFlush();
      };
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      cleanup.current = () => {
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        cleanup.current = null;
      };
      return;
    }
    // Touch: pointerdown also fires when a scroll begins. Only start after a short hold without movement;
    // before that, the browser's pointercancel (it took the gesture over for scrolling) aborts the start.
    // Once the flush runs, the hold lasts until the finger lifts: scrolling is blocked, and if the browser
    // scrolls anyway the touch events still report the release after the pointer events have stopped.
    const { clientX, clientY } = e;
    let started = false;
    // The touch events carry their own ids; the matching touch is the one that starts where this pointer did.
    let touchId;
    const timer = setTimeout(() => {
      started = true;
      latest.current.startFlush();
    }, TOUCH_HOLD_MS);
    const onMove = ev => {
      if (started || ev.pointerId !== pointerId) return;
      if (Math.hypot(ev.clientX - clientX, ev.clientY - clientY) > TOUCH_MOVE_PX) {
        cleanup.current?.();
      }
    };
    const onUp = ev => {
      if (ev.pointerId !== pointerId) return;
      const wasStarted = started;
      cleanup.current?.();
      if (wasStarted) latest.current.stopFlush();
    };
    const onCancel = ev => {
      if (ev.pointerId === pointerId && !started) cleanup.current?.();
    };
    const onTouchStart = ev => {
      if (touchId !== undefined) return;
      const touch = [...ev.changedTouches].find(
        tc => Math.hypot(tc.clientX - clientX, tc.clientY - clientY) <= 1,
      );
      if (touch) touchId = touch.identifier;
    };
    const onTouchMove = ev => {
      if (started && ev.cancelable) ev.preventDefault();
    };
    const onTouchEnd = ev => {
      if (!started) return;
      if (touchId !== undefined && ![...ev.changedTouches].some(tc => tc.identifier === touchId))
        return;
      cleanup.current?.();
      latest.current.stopFlush();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    cleanup.current = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      cleanup.current = null;
    };
  };
  // A fixed-length flush leaves the keys to the native click.
  const onKeyDown = e => {
    if (isHoldFlush && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      startFlush();
    }
  };
  const onKeyUp = e => {
    if (isHoldFlush && (e.key === 'Enter' || e.key === ' ')) stopFlush();
  };
  return (
    <button
      type='button'
      className={`${className} select-none [-webkit-touch-callout:none] ${isFlushing ? 'btn-active' : ''}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      // A long press opens the context menu (and cancels the pointer), which would stop a hold-to-flush.
      onContextMenu={e => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      aria-pressed={isFlushing}
      aria-label={t`Flush water`}
    >
      <FontAwesomeIcon icon={faTint} /> <Trans context='action'>Flush</Trans>
    </button>
  );
}

FlushButton.propTypes = {
  className: PropTypes.string.isRequired,
  isFlushing: PropTypes.bool.isRequired,
  isHoldFlush: PropTypes.bool,
  startFlush: PropTypes.func.isRequired,
  stopFlush: PropTypes.func.isRequired,
};
