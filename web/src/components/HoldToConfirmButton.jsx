import { h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export function HoldToConfirmButton({
  onConfirm,
  holdDurationMs = 2000,
  children,
  className = '',
  disabled = false,
  fillClass = 'bg-error/20',
  ...props
}) {
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef(null);

  const startHold = useCallback(
    e => {
      // Only respond to primary button (left click) or touch
      if (e.button !== undefined && e.button !== 0) return;
      if (disabled) return;
      setIsHolding(true);

      // Optional: add a slight haptic feedback on mobile if supported
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    },
    [disabled],
  );

  const cancelHold = useCallback(() => {
    setIsHolding(false);
  }, []);

  useEffect(() => {
    if (isHolding) {
      timerRef.current = setTimeout(() => {
        setIsHolding(false);
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([50, 50, 50]); // Success vibration
        }
        if (onConfirm) onConfirm();
      }, holdDurationMs);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isHolding, holdDurationMs, onConfirm]);

  // Context menu prevention to stop touch-and-hold from bringing up OS menus
  const onContextMenu = useCallback(
    e => {
      if (isHolding || disabled) {
        e.preventDefault();
        return false;
      }
    },
    [isHolding, disabled],
  );

  return (
    <button
      {...props}
      className={`relative overflow-hidden ${className} ${disabled ? 'cursor-not-allowed opacity-50' : 'select-none'}`}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={onContextMenu}
      disabled={disabled}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
      }}
    >
      <div
        className={`pointer-events-none absolute inset-0 origin-left rounded-[inherit] ${fillClass}`}
        style={{
          transform: isHolding ? 'scaleX(1)' : 'scaleX(0)',
          transition: isHolding
            ? `transform ${holdDurationMs}ms linear`
            : 'transform 150ms ease-out',
          willChange: 'transform',
        }}
      />
      {children}
    </button>
  );
}
