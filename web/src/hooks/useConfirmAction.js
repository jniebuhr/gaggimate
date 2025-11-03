import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

/**
 * useConfirmAction
 * A small hook to implement two-step confirm actions with an auto-cancel timer.
 *
 * Behavior:
 * - First trigger arms the confirmation (armed = true).
 * - Second trigger within the timeout executes the provided action.
 * - Auto-cancels after `timeoutMs` or on unmount.
 *
 * Returns:
 * - armed: boolean — whether confirmation is armed
 * - armOrRun: (fn?: () => void) => void — call on click; runs fn only if already armed
 * - reset: () => void — manually cancel the confirmation state and clear timer
 * - setArmed: React setter if custom control is needed
 */
export function useConfirmAction(timeoutMs = 4000) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  // Auto-cancel after timeout and cleanup on unmount
  useEffect(() => {
    if (armed) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setArmed(false), timeoutMs);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [armed, timeoutMs]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  }, []);

  const armOrRun = useCallback(
    (fn) => {
      if (!armed) {
        setArmed(true);
      } else {
        // Confirmed
        reset();
        if (typeof fn === 'function') fn();
      }
    },
    [armed, reset],
  );

  return { armed, setArmed, armOrRun, reset };
}
