/**
 * NotesBar.jsx
 * Compact horizontal metadata bar below the StatusBar.
 * Click anywhere (except nav arrows) to expand the notes panel.
 * Edit mode lives in the expanded panel with vertical layout.
 */

/* global globalThis */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faArrowTurnUp } from '@fortawesome/free-solid-svg-icons/faArrowTurnUp';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faDivide } from '@fortawesome/free-solid-svg-icons/faDivide';
import { faTag } from '@fortawesome/free-solid-svg-icons/faTag';
import { faGears } from '@fortawesome/free-solid-svg-icons/faGears';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faLaptopFile } from '@fortawesome/free-solid-svg-icons/faLaptopFile';
import { notesService } from '../services/NotesService';
import { cleanName, analyzerUiColors, detectDoseFromProfileName } from '../utils/analyzerUtils';
import { NotesBarExpanded } from './NotesBarExpanded';
import { SourceMarker } from './SourceMarker';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';

function isTypingTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element ? target : document.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!activeElement.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

function formatNotesBarDateTime(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function getShotDuration(currentShot) {
  if (currentShot?.samples?.length) {
    const first = currentShot.samples[0].t;
    const last = currentShot.samples[currentShot.samples.length - 1].t;
    return `${Math.round((last - first) / 1000)}s`;
  }

  const fallbackDuration = Number.parseFloat(currentShot?.duration);
  if (Number.isFinite(fallbackDuration) && fallbackDuration > 0) {
    return `${Math.round(fallbackDuration)}s`;
  }

  return '—';
}

function getShotDisplayName(currentShot, currentShotName) {
  if (currentShot?.source === 'gaggimate') {
    return `#${currentShot.id}`;
  }
  return cleanName(currentShotName);
}

function getModeHintCopy(nextMode) {
  return nextMode === 'browser'
    ? 'Save to Browser. Imported shots and profiles will now be saved to the browser library.'
    : 'View temporarily. Imported shots and profiles will now open temporarily in the analyzer.';
}

function getShotNotesKey(shot) {
  if (!shot) return '';
  if (shot.source === 'gaggimate') return String(shot.id || '');
  return String(shot.storageKey || shot.name || shot.id || '');
}

function hydrateLoadedShotNotes({ loaded, currentShot, calculateRatio }) {
  const nextNotes = { ...loaded };
  let autoSave = false;

  if (!nextNotes.doseIn && currentShot.profile) {
    const extractedDose = detectDoseFromProfileName(currentShot.profile);
    if (extractedDose !== null) {
      nextNotes.doseIn = String(extractedDose);
      autoSave = true;
    }
  }

  if (!nextNotes.doseOut && currentShot.volume) {
    nextNotes.doseOut = currentShot.volume.toFixed(1);
    autoSave = true;
  }

  if (nextNotes.doseIn && nextNotes.doseOut) {
    nextNotes.ratio = calculateRatio(nextNotes.doseIn, nextNotes.doseOut);
  }

  return { nextNotes, autoSave };
}

function getNotesBarNavigationState({ hasShot, shotList, activeShot, getShotNotesKey }) {
  const currentIndex = hasShot
    ? shotList.findIndex(
        shot =>
          getShotNotesKey(shot) === getShotNotesKey(activeShot) &&
          shot.source === activeShot?.source,
      )
    : -1;

  return {
    currentIndex,
    canGoPrev: hasShot && currentIndex > 0,
    canGoNext: hasShot && currentIndex >= 0 && currentIndex < shotList.length - 1,
  };
}

function LoadedShotSummary({
  chipGap,
  currentShot,
  currentShotName,
  currentProfileName,
  fieldCls,
  getDurationLabel,
  notes,
  isEditing,
  isSelectionPending,
  onToggleNotesExpanded,
}) {
  return (
    <button
      type='button'
      className='shot-analyzer-notes-scroll block w-full min-w-0 cursor-pointer overflow-x-auto overflow-y-hidden px-1 py-1.5 text-center'
      onClick={() =>
        !isEditing && !isSelectionPending && onToggleNotesExpanded && onToggleNotesExpanded()
      }
      title={isSelectionPending ? 'Loading shot...' : 'Click to expand notes'}
    >
      <div
        className='mx-auto inline-flex min-w-max items-center justify-center'
        style={{ columnGap: chipGap }}
      >
        {currentShot?.source === 'temp' ? (
          <span
            className='text-base-content/45 inline-flex items-center justify-center'
            style={{ lineHeight: 0 }}
            aria-label='VIEW'
            title='Temporary Analyzer View'
          >
            <FontAwesomeIcon icon={faEye} className='text-[0.72rem]' />
          </span>
        ) : (
          <SourceMarker source={currentShot?.source} variant='library' />
        )}
        <span className={fieldCls}>{getShotDisplayName(currentShot, currentShotName)}</span>
        <span className={fieldCls}>
          {cleanName(currentProfileName || currentShot.profile || '—')}
        </span>
        <span className={fieldCls}>{formatNotesBarDateTime(currentShot.timestamp)}</span>
        <span className={`${fieldCls} flex items-center gap-1`}>
          <FontAwesomeIcon icon={faClock} className='text-[10px] opacity-50' />
          {getDurationLabel}
        </span>
        <span className={`${fieldCls} flex items-center gap-1`}>
          <FontAwesomeIcon icon={faDivide} className='text-[10px] opacity-50' />
          {notes.ratio ? `1:${notes.ratio}` : '—'}
        </span>
        <span className={`${fieldCls} flex items-center gap-1`}>
          <FontAwesomeIcon icon={faWeightScale} className='text-[10px] opacity-50' />
          {notes.doseIn || '—'}g ▸ {notes.doseOut || '—'}g
        </span>
        <span className={`${fieldCls} flex items-center gap-1`}>
          <FontAwesomeIcon icon={faTag} className='text-[10px] opacity-50' />
          {notes.beanType || '—'}
        </span>
        <span className={`${fieldCls} flex items-center gap-1`}>
          <FontAwesomeIcon icon={faGears} className='text-[10px] opacity-50' />
          {notes.grindSetting || '—'}
        </span>
        <span className={`${fieldCls} capitalize`}>{notes.balanceTaste}</span>
        <span className={`${fieldCls} flex items-center gap-1`}>
          <FontAwesomeIcon
            icon={faStar}
            className={`text-[10px] ${notes.rating > 0 ? 'opacity-60' : 'opacity-30'}`}
          />
          {notes.rating > 0 ? `${notes.rating}/5` : '—'}
        </span>
      </div>
    </button>
  );
}

function PlaceholderShotSummary() {
  return (
    <div className='flex min-w-0 items-center justify-center px-2 py-1.5 text-center text-sm font-medium italic opacity-70'>
      <span className='inline-flex flex-wrap items-center justify-center gap-1.5'>
        <FontAwesomeIcon
          icon={faArrowTurnUp}
          className='text-[0.72rem] opacity-80'
          style={{ transform: 'scaleX(-1)' }}
        />
        <span>Drag &amp; Drop</span>
        <FontAwesomeIcon icon={faArrowTurnUp} className='text-[0.72rem] opacity-80' />
      </span>
    </div>
  );
}

function ModeHintPortal({ modeHint, modeHintBadgeStyle, modeHintPosition, modeHintVariant }) {
  if (!modeHint) return null;

  return createPortal(
    <div
      className='border-base-content/10 bg-base-100/95 pointer-events-none fixed z-[85] rounded-xl border px-3 py-2 shadow-xl backdrop-blur-sm'
      style={{
        top: `${modeHintPosition.top}px`,
        left: `${modeHintPosition.left}px`,
        width: 'min(22rem, calc(100vw - 2rem))',
      }}
    >
      <div className='text-base-content/80 flex items-center gap-2 text-xs leading-5'>
        <span
          className='inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-bold tracking-[0.14em] uppercase'
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

function useNotesBarModeHint({ importMode, onImportModeChange }) {
  const modeButtonRef = useRef(null);
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
    const rect = modeButtonRef.current?.getBoundingClientRect();
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

export function NotesBar({
  currentShot,
  currentShotName,
  selectedShot = null,
  selectedShotName = 'No Shot Loaded',
  selectedProfileName = 'No Profile Loaded',
  shotList = [],
  onNavigate,
  importMode = 'temp',
  onImportModeChange,
  isExpanded = false,
  isSelectionPending = false,
  isProfilePending = false,
  notesExpanded = false,
  onToggleNotesExpanded,
  onEditingChange,
  onExpandedHeightChange,
  showImportModeToggle = true,
  enableKeyboardNavigation = true,
}) {
  // Shared responsive spacing for nav arrows and center info chips.
  // Keeps a visible minimum separation while adapting on wider layouts.
  const chipGap = 'clamp(0.35rem, 0.9vw, 0.7rem)';

  const [notes, setNotes] = useState(notesService.getDefaults(null));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const displayShot = selectedShot || currentShot;
  const displayShotName = selectedShot ? selectedShotName : currentShotName;
  const displayProfileName = cleanName(
    selectedProfileName || displayShot?.profile || 'No Profile Loaded',
  );
  const hasLoadedShot = !!currentShot;
  const hasDisplayShot = !!displayShot;
  const showExpanded = hasLoadedShot && notesExpanded && !isSelectionPending;
  const expandedPanelRef = useRef(null);
  const loadIndicatorHideTimerRef = useRef(null);
  const [loadIndicatorVisible, setLoadIndicatorVisible] = useState(false);
  const [loadIndicatorProgress, setLoadIndicatorProgress] = useState(0);
  const {
    modeButtonRef,
    modeHint,
    modeHintVariant,
    modeHintPosition,
    modeHintBadgeStyle,
    handleModeToggle,
  } = useNotesBarModeHint({
    importMode,
    onImportModeChange,
  });
  const clearLoadIndicatorHideTimer = useCallback(() => {
    if (loadIndicatorHideTimerRef.current) {
      globalThis.clearTimeout(loadIndicatorHideTimerRef.current);
      loadIndicatorHideTimerRef.current = null;
    }
  }, []);
  const isCombinedLoadActive = isSelectionPending || isProfilePending || loading;
  const loadIndicatorTargetProgress = isSelectionPending
    ? 0.36
    : isProfilePending
      ? 0.78
      : loading
        ? 0.92
        : 1;
  const loadIndicatorWidth = loadIndicatorVisible
    ? `${Math.min(100, Math.max(loadIndicatorProgress * 100, 8))}%`
    : '0%';

  const calculateRatio = useCallback((doseIn, doseOut) => {
    if (doseIn && doseOut && parseFloat(doseIn) > 0 && parseFloat(doseOut) > 0) {
      return (parseFloat(doseOut) / parseFloat(doseIn)).toFixed(2);
    }
    return '';
  }, []);

  // Load notes when shot changes
  useEffect(() => {
    if (!currentShot) {
      setLoading(false);
      setIsEditing(false);
      setNotes(notesService.getDefaults(null));
      return;
    }
    let cancelled = false;
    const notesKey = getShotNotesKey(currentShot);
    const inlineNotes =
      currentShot.notes && typeof currentShot.notes === 'object'
        ? { ...notesService.getDefaults(notesKey), ...currentShot.notes, id: notesKey }
        : null;
    setLoading(true);
    setIsEditing(false);

    // Show imported notes immediately (before async persistence load resolves).
    if (inlineNotes) {
      setNotes(inlineNotes);
    }

    notesService
      .loadNotes(notesKey, currentShot.source)
      .then(loaded => {
        if (cancelled) return;
        // Inline notes (from fresh import) should win over empty/default persistence results.
        loaded = inlineNotes ? { ...loaded, ...inlineNotes, id: notesKey } : loaded;
        const { nextNotes, autoSave } = hydrateLoadedShotNotes({
          loaded,
          currentShot,
          calculateRatio,
        });

        setNotes(nextNotes);

        // Auto-save if we populated new values
        if (autoSave && currentShot.source !== 'temp') {
          notesService.saveNotes(notesKey, currentShot.source, nextNotes);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentShot,
    currentShot?.id,
    currentShot?.name,
    currentShot?.storageKey,
    currentShot?.source,
    calculateRatio,
  ]);

  useEffect(() => {
    if (!isSelectionPending) return;
    setIsEditing(false);
  }, [isSelectionPending]);

  useEffect(() => {
    clearLoadIndicatorHideTimer();

    if (isCombinedLoadActive) {
      setLoadIndicatorVisible(true);
      setLoadIndicatorProgress(loadIndicatorTargetProgress);
      return undefined;
    }

    if (!loadIndicatorVisible) {
      setLoadIndicatorProgress(0);
      return undefined;
    }

    setLoadIndicatorProgress(1);
    loadIndicatorHideTimerRef.current = globalThis.setTimeout(() => {
      setLoadIndicatorVisible(false);
      setLoadIndicatorProgress(0);
      loadIndicatorHideTimerRef.current = null;
    }, 220);

    return clearLoadIndicatorHideTimer;
  }, [
    clearLoadIndicatorHideTimer,
    isCombinedLoadActive,
    loadIndicatorTargetProgress,
    loadIndicatorVisible,
  ]);

  useEffect(() => clearLoadIndicatorHideTimer, [clearLoadIndicatorHideTimer]);

  const handleInputChange = (field, value) => {
    setNotes(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'doseIn' || field === 'doseOut') {
        const dIn = field === 'doseIn' ? value : prev.doseIn;
        const dOut = field === 'doseOut' ? value : prev.doseOut;
        updated.ratio = calculateRatio(dIn, dOut);
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notesService.saveNotes(getShotNotesKey(currentShot), currentShot.source, notes);
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to save notes:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    notesService.loadNotes(getShotNotesKey(currentShot), currentShot.source).then(loaded => {
      if (loaded.doseIn && loaded.doseOut) {
        loaded.ratio = calculateRatio(loaded.doseIn, loaded.doseOut);
      }
      setNotes(loaded);
    });
  };

  const handleNavigateToIndex = useCallback(
    (targetIndex, direction) => {
      if (targetIndex < 0 || targetIndex >= shotList.length) return;
      onNavigate?.({
        item: shotList[targetIndex],
        direction,
        listSnapshot: shotList,
        targetIndex,
      });
    },
    [onNavigate, shotList],
  );

  // Navigation
  const { currentIndex, canGoPrev, canGoNext } = getNotesBarNavigationState({
    hasShot: hasDisplayShot,
    shotList,
    activeShot: displayShot,
    getShotNotesKey,
  });

  // Keyboard navigation: ArrowLeft / ArrowRight
  useEffect(() => {
    if (!displayShot || !enableKeyboardNavigation) return;

    const handleKeyDown = e => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'ArrowLeft' && canGoPrev) {
        e.preventDefault();
        handleNavigateToIndex(currentIndex - 1, -1);
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        handleNavigateToIndex(currentIndex + 1, 1);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [
    displayShot,
    canGoPrev,
    canGoNext,
    currentIndex,
    handleNavigateToIndex,
    enableKeyboardNavigation,
  ]);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    if (!showExpanded) {
      onExpandedHeightChange?.(0);
      return;
    }

    const panelEl = expandedPanelRef.current;
    if (!panelEl) {
      onExpandedHeightChange?.(0);
      return;
    }

    const reportHeight = () => onExpandedHeightChange?.(panelEl.offsetHeight || 0);
    reportHeight();

    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(reportHeight);
    resizeObserver.observe(panelEl);
    return () => resizeObserver.disconnect();
  }, [showExpanded, onExpandedHeightChange]);

  const borderClasses = 'border-base-content/5 border-t';

  const fieldCls =
    'shrink-0 rounded-md bg-base-200/60 px-2 py-1 text-xs font-medium whitespace-nowrap';
  const navButtonClasses = getAnalyzerIconButtonClasses({
    className: 'btn btn-xs btn-ghost h-6 w-6 flex-shrink-0 rounded-lg p-0',
  });
  const modeButtonClasses = getAnalyzerIconButtonClasses({
    tone: 'subtle',
    className: 'btn btn-xs btn-ghost h-6 w-6 flex-shrink-0 rounded-lg p-0 hover:opacity-100',
  });

  return (
    <div>
      <div className={`overflow-hidden transition-all duration-200 ${borderClasses}`}>
        <div
          className='grid w-full items-center px-1.5 py-0.5 sm:px-2'
          style={{
            columnGap: chipGap,
            gridTemplateColumns: hasDisplayShot
              ? 'auto minmax(0, 1fr) auto auto'
              : 'auto minmax(0, 1fr) auto',
          }}
        >
          {hasDisplayShot ? (
            <button
              className={navButtonClasses}
              disabled={!canGoPrev}
              onClick={() => canGoPrev && handleNavigateToIndex(currentIndex - 1, -1)}
              title='Previous shot'
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
          ) : (
            <span aria-hidden='true' className='h-6 w-6 flex-shrink-0' />
          )}

          {hasDisplayShot ? (
            <LoadedShotSummary
              chipGap={chipGap}
              currentShot={displayShot}
              currentShotName={displayShotName}
              currentProfileName={displayProfileName}
              fieldCls={fieldCls}
              getDurationLabel={getShotDuration(displayShot)}
              notes={
                isSelectionPending
                  ? {
                      ...notes,
                      ratio: '',
                      doseIn: '',
                      doseOut: '',
                      beanType: '',
                      grindSetting: '',
                      balanceTaste: '',
                      rating: 0,
                    }
                  : notes
              }
              isEditing={isEditing}
              isSelectionPending={isSelectionPending}
              onToggleNotesExpanded={onToggleNotesExpanded}
            />
          ) : (
            <PlaceholderShotSummary />
          )}

          {hasDisplayShot && (
            <button
              className={navButtonClasses}
              disabled={!canGoNext}
              onClick={() => canGoNext && handleNavigateToIndex(currentIndex + 1, 1)}
              title='Next shot'
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          )}

          {showImportModeToggle ? (
            <button
              ref={modeButtonRef}
              type='button'
              className={`${modeButtonClasses} ${importMode === 'browser' ? 'opacity-75' : 'opacity-60'}`}
              style={
                importMode === 'browser'
                  ? { color: analyzerUiColors.sourceBadgeWebText }
                  : undefined
              }
              onClick={handleModeToggle}
              title={
                importMode === 'browser'
                  ? 'Save to Browser. Click to switch imports to View temporarily.'
                  : 'View temporarily. Click to switch imports to Save to Browser.'
              }
              aria-label={
                importMode === 'browser'
                  ? 'Switch import mode to View temporarily'
                  : 'Switch import mode to Save to Browser'
              }
            >
              <FontAwesomeIcon
                icon={importMode === 'browser' ? faLaptopFile : faEye}
                className='text-xs'
              />
            </button>
          ) : (
            <span aria-hidden='true' className='h-6 w-6 flex-shrink-0' />
          )}
        </div>

        {loadIndicatorVisible && (
          <div className='bg-primary/15 h-0.5 w-full overflow-hidden'>
            <div
              className='bg-primary h-full rounded-full transition-[width] duration-200 ease-out'
              style={{ width: loadIndicatorWidth }}
            />
          </div>
        )}
      </div>

      {/* Expanded Notes Panel */}
      {showExpanded && (
        <div ref={expandedPanelRef}>
          <NotesBarExpanded
            currentShot={currentShot}
            notes={notes}
            isEditing={isEditing}
            saving={saving}
            onInputChange={handleInputChange}
            onEdit={() => setIsEditing(true)}
            onSave={handleSave}
            onCancel={handleCancel}
            onCollapse={onToggleNotesExpanded}
            isExpanded={isExpanded}
          />
        </div>
      )}

      <ModeHintPortal
        modeHint={modeHint}
        modeHintBadgeStyle={modeHintBadgeStyle}
        modeHintPosition={modeHintPosition}
        modeHintVariant={modeHintVariant}
      />
    </div>
  );
}
