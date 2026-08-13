import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { analyzerUiColors } from '../../utils/analyzerUtils';

function getModeHintCopy(nextMode) {
  return nextMode === 'browser'
    ? 'Save to Browser. Imported shots and profiles will now be saved to the browser library.'
    : 'View temporarily. Imported shots and profiles will now open temporarily in the analyzer.';
}

export function ModeHintPortal({
  modeHint,
  modeHintBadgeStyle,
  modeHintPosition,
  modeHintVariant,
}) {
  if (!modeHint) return null;

  return createPortal(
    <div
      className='border-base-content/10 bg-base-100/95 pointer-events-none fixed z-[10000] rounded-xl border px-3 py-2 shadow-xl backdrop-blur-sm'
      style={{
        top: `${modeHintPosition.top}px`,
        left: `${modeHintPosition.left}px`,
        width: 'min(22rem, calc(100vw - 2rem))',
      }}
    >
      <div className='text-base-content/80 flex items-center gap-2 text-xs leading-5'>
        <span
          className='inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium'
          style={modeHintBadgeStyle}
        >
          {modeHintVariant === 'browser' ? 'SAVE' : 'VIEW'}
        </span>
        <span className='min-w-0'>{modeHint}</span>
      </div>
    </div>,
    document.body,
  );
}

export function useAnalyzerActionBarModeHint({ importMode, onImportModeChange }) {
  const modeButtonRef = useRef(null);
  const modeHintAnchorRef = useRef(null);
  const modeHintAnchorRectRef = useRef(null);
  const modeHintTimerRef = useRef(null);
  const modeHintDismissArmTimerRef = useRef(null);
  const modeHintDismissReadyRef = useRef(false);
  const [modeHint, setModeHint] = useState('');
  const [modeHintVariant, setModeHintVariant] = useState('temp');
  const [modeHintPosition, setModeHintPosition] = useState({ top: 0, left: 12 });

  const clearModeHintTimers = useCallback(() => {
    if (modeHintTimerRef.current) {
      globalThis.clearTimeout(modeHintTimerRef.current);
      modeHintTimerRef.current = null;
    }
    if (modeHintDismissArmTimerRef.current) {
      globalThis.clearTimeout(modeHintDismissArmTimerRef.current);
      modeHintDismissArmTimerRef.current = null;
    }
  }, []);

  const updateModeHintPosition = useCallback(() => {
    const anchorElement = modeHintAnchorRef.current || modeButtonRef.current;
    const rect = anchorElement?.isConnected
      ? anchorElement.getBoundingClientRect()
      : modeHintAnchorRectRef.current;
    if (!rect) return;
    const viewportWidth = globalThis.innerWidth || 0;
    const hintWidth = Math.min(352, Math.max(0, viewportWidth - 32));
    const maxLeft = Math.max(12, viewportWidth - hintWidth - 12);
    setModeHintPosition({
      top: rect.bottom + 10,
      left: Math.min(Math.max(12, rect.left), maxLeft),
    });
  }, []);

  const showModeHint = useCallback(
    nextMode => {
      const browserMode = nextMode === 'browser';
      setModeHintVariant(browserMode ? 'browser' : 'temp');
      setModeHint(getModeHintCopy(nextMode));
      updateModeHintPosition();
      clearModeHintTimers();
      modeHintDismissReadyRef.current = false;
      modeHintDismissArmTimerRef.current = globalThis.setTimeout(() => {
        modeHintDismissReadyRef.current = true;
      }, 180);
      modeHintTimerRef.current = globalThis.setTimeout(() => {
        setModeHint('');
      }, 4200);
    },
    [clearModeHintTimers, updateModeHintPosition],
  );

  const handleModeToggle = useCallback(
    event => {
      event.preventDefault();
      event.stopPropagation();
      if (!onImportModeChange) return;
      modeHintAnchorRef.current = event.currentTarget;
      modeHintAnchorRectRef.current = event.currentTarget.getBoundingClientRect();
      const nextMode = importMode === 'browser' ? 'temp' : 'browser';
      onImportModeChange(nextMode);
      showModeHint(nextMode);
    },
    [importMode, onImportModeChange, showModeHint],
  );

  useEffect(() => {
    return () => {
      clearModeHintTimers();
    };
  }, [clearModeHintTimers]);

  useEffect(() => {
    if (!modeHint) return;
    updateModeHintPosition();
    const handleViewportChange = () => updateModeHintPosition();
    globalThis.addEventListener('resize', handleViewportChange);
    globalThis.addEventListener('scroll', handleViewportChange, true);
    return () => {
      globalThis.removeEventListener('resize', handleViewportChange);
      globalThis.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [modeHint, updateModeHintPosition]);

  useEffect(() => {
    if (!modeHint) return;
    const dismissHint = () => {
      if (!modeHintDismissReadyRef.current) return;
      setModeHint('');
    };
    document.addEventListener('pointerdown', dismissHint, true);
    return () => {
      document.removeEventListener('pointerdown', dismissHint, true);
    };
  }, [modeHint]);

  return {
    modeButtonRef,
    modeHint,
    modeHintVariant,
    modeHintPosition,
    modeHintBadgeStyle:
      modeHintVariant === 'browser'
        ? {
            backgroundColor: analyzerUiColors.sourceBadgeWebBg,
            borderColor: analyzerUiColors.sourceBadgeWebBorder,
            color: analyzerUiColors.sourceBadgeWebText,
          }
        : undefined,
    handleModeToggle,
  };
}
