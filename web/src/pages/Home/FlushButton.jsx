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
  const press = useRef(null);

  const endPress = () => {
    const current = press.current;
    if (!current) return;
    press.current = null;
    clearTimeout(current.timer);
    for (const [target, type, fn, opts] of current.listeners)
      target.removeEventListener(type, fn, opts);
    if (current.started) latest.current.stopFlush();
  };

  useEffect(() => endPress, []);

  const beginPress = (started, listeners) => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') endPress();
    };
    const all = [
      ...listeners,
      [window, 'blur', endPress],
      [document, 'visibilitychange', onHidden],
    ];
    for (const [target, type, fn, opts] of all) target.addEventListener(type, fn, opts);
    press.current = { started, listeners: all, timer: undefined };
    if (started) latest.current.startFlush();
  };

  const onClick = () => {
    if (!isHoldFlush) startFlush();
  };
  const onPointerDown = e => {
    if (!isHoldFlush || press.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { pointerId } = e;
    if (e.pointerType !== 'touch') {
      const onEnd = ev => {
        if (ev.pointerId === pointerId) endPress();
      };
      beginPress(true, [
        [window, 'pointerup', onEnd],
        [window, 'pointercancel', onEnd],
      ]);
      return;
    }
    // Touch: pointerdown also fires when a scroll begins. Only start after a short hold without movement;
    // before that, the browser's pointercancel (it took the gesture over for scrolling) aborts the start.
    // Once the flush runs, the hold lasts until the finger lifts: scrolling is blocked, and if the browser
    // scrolls anyway the touch events still report the release after the pointer events have stopped.
    const { clientX, clientY } = e;
    // The touch events carry their own ids; the matching touch is the one that starts where this pointer did.
    let touchId;
    const started = () => press.current?.started;
    const onMove = ev => {
      if (started() || ev.pointerId !== pointerId) return;
      if (Math.hypot(ev.clientX - clientX, ev.clientY - clientY) > TOUCH_MOVE_PX) endPress();
    };
    const onUp = ev => {
      if (ev.pointerId === pointerId) endPress();
    };
    const onCancel = ev => {
      if (ev.pointerId === pointerId && !started()) endPress();
    };
    const onTouchStart = ev => {
      if (touchId !== undefined) return;
      const touch = [...ev.changedTouches].find(
        tc => Math.hypot(tc.clientX - clientX, tc.clientY - clientY) <= 1,
      );
      if (touch) touchId = touch.identifier;
    };
    const onTouchMove = ev => {
      if (started() && ev.cancelable) ev.preventDefault();
    };
    const onTouchEnd = ev => {
      if (!started()) return;
      if (touchId !== undefined && ![...ev.changedTouches].some(tc => tc.identifier === touchId))
        return;
      endPress();
    };
    beginPress(false, [
      [window, 'pointermove', onMove],
      [window, 'touchstart', onTouchStart],
      [window, 'pointerup', onUp],
      [window, 'pointercancel', onCancel],
      [window, 'touchmove', onTouchMove, { passive: false }],
      [window, 'touchend', onTouchEnd],
      [window, 'touchcancel', onTouchEnd],
    ]);
    press.current.timer = setTimeout(() => {
      press.current.started = true;
      latest.current.startFlush();
    }, TOUCH_HOLD_MS);
  };
  // A fixed-length flush leaves the keys to the native click. The keyup is caught on the window so it
  // still ends the hold when focus moved off the button meanwhile.
  const onKeyDown = e => {
    if (!isHoldFlush || press.current || e.repeat) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const { key } = e;
    const onKeyUp = ev => {
      if (ev.key === key) endPress();
    };
    beginPress(true, [[window, 'keyup', onKeyUp]]);
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
