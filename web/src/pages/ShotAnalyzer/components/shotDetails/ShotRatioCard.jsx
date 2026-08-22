/** Keeps ratio editing, dose previews, and notes persistence in one lifecycle boundary. */

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { formatMetricValue } from '../../utils/analyzerUtils';
import { useShotNotesState } from '../useShotNotesState';

const DEFAULT_RATIO = 2;
const RATIO_SLIDER_MIN = 1;
const RATIO_SLIDER_MAX = 4;
const RATIO_SLIDER_STEP = 0.1;

function clampRatioValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return RATIO_SLIDER_MIN;
  return Math.min(RATIO_SLIDER_MAX, Math.max(RATIO_SLIDER_MIN, numericValue));
}

function getRatioValueFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const pointerX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const progress = rect.width > 0 ? pointerX / rect.width : 0;
  const rawValue = RATIO_SLIDER_MIN + progress * (RATIO_SLIDER_MAX - RATIO_SLIDER_MIN);
  const steppedValue = Math.round(rawValue / RATIO_SLIDER_STEP) * RATIO_SLIDER_STEP;

  return clampRatioValue(steppedValue).toFixed(1);
}

function formatDosePreviewValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue.toFixed(1) : '-';
}

function getRatioDosePreview(notes, ratio) {
  const numericRatio = Number(ratio);
  const doseIn = Number(notes?.doseIn);
  const doseOut = Number(notes?.doseOut);

  if (!Number.isFinite(numericRatio) || numericRatio <= 0) {
    return { doseIn: null, doseOut: null };
  }

  if (Number.isFinite(doseOut) && doseOut > 0) {
    return {
      doseIn: doseOut / numericRatio,
      doseOut,
    };
  }

  if (Number.isFinite(doseIn) && doseIn > 0) {
    return {
      doseIn,
      doseOut: doseIn * numericRatio,
    };
  }

  return { doseIn: null, doseOut: null };
}

function getCoffeeType(r) {
  if (!r) return null;
  const v = Number(r);
  if (v <= 1.5) return 'Ristretto';
  if (v <= 2.5) return 'Espresso';
  return 'Lungo';
}

export function useRatioCardState({ currentShot, entryKey }) {
  const { notes, loading, handleInputChange, saveNotes, updateAndSave } = useShotNotesState({
    currentShot,
  });
  const saveTimerRef = useRef(null);
  const [sliderRatio, setSliderRatio] = useState(DEFAULT_RATIO);
  const [sliderTouched, setSliderTouched] = useState(false);
  const [isEditingRatio, setIsEditingRatio] = useState(false);

  useEffect(() => {
    if (!notes.ratio) setSliderTouched(false);
  }, [notes.ratio]);

  useEffect(() => {
    const numericRatio = Number(notes.ratio);
    if (Number.isFinite(numericRatio)) setSliderRatio(numericRatio.toFixed(1));
  }, [notes.ratio]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(() => {
    clearSaveTimer();
    saveNotes();
  }, [clearSaveTimer, saveNotes]);

  const scheduleSave = useCallback(() => {
    clearSaveTimer();
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveNotes();
    }, 650);
  }, [clearSaveTimer, saveNotes]);

  const handleFieldChange = useCallback(
    (field, value) => {
      handleInputChange(field, value);
      scheduleSave();
    },
    [handleInputChange, scheduleSave],
  );

  const handleRatioCommit = useCallback(
    async value => {
      clearSaveTimer();
      setIsEditingRatio(false);
      await updateAndSave('ratio', value);
    },
    [clearSaveTimer, updateAndSave],
  );

  useEffect(() => clearSaveTimer, [clearSaveTimer, entryKey]);

  return {
    flushSave,
    handleFieldChange,
    handleRatioCommit,
    loading,
    notes,
    isEditingRatio,
    sliderRatio,
    sliderTouched,
    updateAndSave,
    setIsEditingRatio,
    setSliderRatio,
    setSliderTouched,
  };
}

export function ShotRatioCard({
  notes,
  isEditingRatio = false,
  sliderRatio,
  sliderTouched,
  onSliderInput,
  onSliderActivate,
  onRatioCommit,
  onEditRatio,
  className = '',
}) {
  const showRatioDisplay = notes.ratio && !isEditingRatio;
  const dosePreview = getRatioDosePreview(notes, sliderRatio);
  const sliderCardClass = showRatioDisplay ? '' : 'cursor-ew-resize touch-none select-none';

  const updateRatioFromPointer = event => {
    if (showRatioDisplay) return null;

    const nextRatio = getRatioValueFromPointer(event);
    onSliderActivate();
    onSliderInput(nextRatio);

    return nextRatio;
  };

  return (
    <div
      className={`app-card-surface flex h-[68px] min-w-0 flex-col rounded-xl p-3 lg:h-[60px] lg:p-2.5 xl:h-[68px] xl:p-3 ${sliderCardClass} ${className}`}
      onPointerDown={event => {
        if (showRatioDisplay) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        updateRatioFromPointer(event);
      }}
      onPointerMove={event => {
        if (showRatioDisplay) return;
        if (event.pointerType !== 'touch' && event.buttons !== 1) return;
        updateRatioFromPointer(event);
      }}
      onPointerUp={event => {
        if (showRatioDisplay) return;
        const nextRatio = updateRatioFromPointer(event);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (nextRatio) onRatioCommit(nextRatio);
      }}
      onPointerCancel={event => {
        if (showRatioDisplay) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        onRatioCommit(clampRatioValue(sliderRatio).toFixed(1));
      }}
    >
      {showRatioDisplay ? (
        <div className='flex min-h-0 flex-1 flex-col justify-center'>
          <div className='grid grid-cols-2 gap-1.5 lg:gap-1 xl:gap-1.5'>
            <div className='flex flex-col items-center'>
              <button
                type='button'
                className='hover:text-primary cursor-pointer truncate rounded-sm px-1 text-base leading-none font-normal tabular-nums transition-colors lg:text-sm xl:text-base'
                onClick={onEditRatio}
                aria-label='Edit ratio'
                title='Edit ratio'
              >
                1:{formatMetricValue(notes.ratio, 1)}
              </button>
              <span className='text-base-content/55 mt-0.5 truncate text-xs leading-tight font-medium'>
                Ratio
              </span>
            </div>
            <div className='flex flex-col items-center'>
              <span className='text-base leading-none font-normal lg:text-sm xl:text-base'>
                {getCoffeeType(notes.ratio)}
              </span>
              <span className='text-base-content/55 mt-0.5 truncate text-xs leading-tight font-medium'>
                Type
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className='flex min-h-0 flex-1 flex-col justify-center'>
          <div className='grid min-w-0 grid-cols-3 items-center gap-2'>
            <span
              className={`min-w-0 truncate text-left text-xs font-medium tabular-nums ${
                sliderTouched ? 'text-base-content/35' : 'text-base-content/55'
              }`}
            >
              {sliderTouched ? `${formatDosePreviewValue(dosePreview.doseIn)} g in` : 'Ratio'}
            </span>
            <span className='min-w-0 truncate text-center text-xs font-medium tabular-nums'>
              {sliderTouched ? `1:${formatMetricValue(sliderRatio, 1)}` : ''}
            </span>
            <span className='text-base-content/35 min-w-0 truncate text-right text-xs font-medium tabular-nums'>
              {sliderTouched ? `${formatDosePreviewValue(dosePreview.doseOut)} g out` : '–'}
            </span>
          </div>
          <div className='relative mt-1.5 h-3'>
            <input
              type='range'
              min={RATIO_SLIDER_MIN}
              max={RATIO_SLIDER_MAX}
              step={RATIO_SLIDER_STEP}
              value={sliderRatio}
              onInput={event => onSliderInput(event.currentTarget.value)}
              onFocus={onSliderActivate}
              onKeyUp={event => {
                if (event.key === 'Enter') onRatioCommit(event.currentTarget.value);
              }}
              className={`ratio-slider absolute inset-x-0 top-1/2 w-full -translate-y-1/2 cursor-pointer ${sliderTouched ? 'ratio-slider--touched' : ''}`}
            />
          </div>
          <div className='text-base-content/40 mt-1 flex justify-between px-0.5 text-[0.6rem] leading-none'>
            <span>1:1</span>
            <span>1:2</span>
            <span>1:3</span>
            <span>1:4</span>
          </div>
          <style>{`
            .ratio-slider {
              -webkit-appearance: none;
              appearance: none;
              height: 46px;
              background: transparent;
              outline: none;
              pointer-events: none;
              touch-action: none;
            }
            .ratio-slider::-webkit-slider-runnable-track {
              height: 4px;
              background: color-mix(in srgb, var(--color-base-content) 28%, transparent);
              border-radius: 2px;
            }
            .ratio-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 2px;
              height: 14px;
              margin-top: -5px;
              background: color-mix(in srgb, var(--color-base-content) 32%, transparent);
              border-radius: 1px;
              cursor: pointer;
            }
            .ratio-slider--touched::-webkit-slider-thumb {
              background: var(--color-base-content);
            }
            .ratio-slider::-moz-range-track {
              height: 4px;
              background: color-mix(in srgb, var(--color-base-content) 28%, transparent);
              border-radius: 2px;
            }
            .ratio-slider::-moz-range-thumb {
              width: 2px;
              height: 14px;
              background: color-mix(in srgb, var(--color-base-content) 32%, transparent);
              border-radius: 1px;
              border: none;
              cursor: pointer;
            }
            .ratio-slider--touched::-moz-range-thumb {
              background: var(--color-base-content);
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
