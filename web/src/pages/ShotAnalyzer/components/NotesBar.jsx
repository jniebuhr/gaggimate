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
import { cleanName, analyzerUiColors } from '../utils/analyzerUtils';
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
  if (!currentShot?.samples?.length) return '—';
  const first = currentShot.samples[0].t;
  const last = currentShot.samples[currentShot.samples.length - 1].t;
  return `${Math.round((last - first) / 1000)}s`;
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

function LoadedShotSummary({
  chipGap,
  currentShot,
  currentShotName,
  fieldCls,
  getDurationLabel,
  notes,
  isEditing,
  onToggleNotesExpanded,
}) {
  return (
    <button
      type='button'
      className='scrollbar-none block w-full min-w-0 cursor-pointer overflow-x-auto px-1 py-1.5 text-center'
      onClick={() => !isEditing && onToggleNotesExpanded && onToggleNotesExpanded()}
      title='Click to expand notes'
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
        <span className={fieldCls}>{cleanName(currentShot.profile || '—')}</span>
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

export function NotesBar({
  currentShot,
  currentShotName,
  shotList = [],
  onNavigate,
  importMode = 'temp',
  onImportModeChange,
  isExpanded = false,
  notesExpanded = false,
  onToggleNotesExpanded,
  onEditingChange,
  onExpandedHeightChange,
}) {
  // Shared responsive spacing for nav arrows and center info chips.
  // Keeps a visible minimum separation while adapting on wider layouts.
  const chipGap = 'clamp(0.35rem, 0.9vw, 0.7rem)';

  const getShotNotesKey = useCallback(shot => {
    if (!shot) return '';
    if (shot.source === 'gaggimate') return String(shot.id || '');
    return String(shot.storageKey || shot.name || shot.id || '');
  }, []);

  const [notes, setNotes] = useState(notesService.getDefaults(null));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasShot = !!currentShot;
  const showExpanded = hasShot && notesExpanded;
  const expandedPanelRef = useRef(null);
  const modeButtonRef = useRef(null);
  const modeHintTimerRef = useRef(null);
  const modeHintDismissArmTimerRef = useRef(null);
  const modeHintDismissReadyRef = useRef(false);
  const [modeHint, setModeHint] = useState('');
  const [modeHintVariant, setModeHintVariant] = useState('temp');
  const [modeHintPosition, setModeHintPosition] = useState({ top: 0, left: 12 });

  const calculateRatio = useCallback((doseIn, doseOut) => {
    if (doseIn && doseOut && parseFloat(doseIn) > 0 && parseFloat(doseOut) > 0) {
      return (parseFloat(doseOut) / parseFloat(doseIn)).toFixed(2);
    }
    return '';
  }, []);

  // Extract dose-in from profile name (e.g. "Direct Lever v2 [20g]" → "20", "Auto 16g" → "16")
  const extractDoseFromProfile = useCallback(profileName => {
    if (!profileName) return '';
    const match = profileName.match(/\[?\b(\d+(?:\.\d+)?)\s*g\b\]?/i);
    return match ? match[1] : '';
  }, []);

  // Load notes when shot changes
  useEffect(() => {
    if (!currentShot) return;
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
        let autoSave = false;

        // Auto-populate doseIn from profile name if empty
        if (!loaded.doseIn && currentShot.profile) {
          const extracted = extractDoseFromProfile(currentShot.profile);
          if (extracted) {
            loaded.doseIn = extracted;
            autoSave = true;
          }
        }

        // Auto-populate doseOut from shot volume if empty
        if (!loaded.doseOut && currentShot.volume) {
          loaded.doseOut = currentShot.volume.toFixed(1);
          autoSave = true;
        }

        if (loaded.doseIn && loaded.doseOut) {
          loaded.ratio = calculateRatio(loaded.doseIn, loaded.doseOut);
        }

        setNotes(loaded);

        // Auto-save if we populated new values
        if (autoSave && currentShot.source !== 'temp') {
          notesService.saveNotes(notesKey, currentShot.source, loaded);
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
    extractDoseFromProfile,
    getShotNotesKey,
  ]);

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

  // Navigation
  const currentIndex = hasShot
    ? shotList.findIndex(
        s =>
          getShotNotesKey(s) === getShotNotesKey(currentShot) && s.source === currentShot?.source,
      )
    : -1;
  const canGoPrev = hasShot && currentIndex > 0;
  const canGoNext = hasShot && currentIndex >= 0 && currentIndex < shotList.length - 1;

  // Keyboard navigation: ArrowLeft / ArrowRight
  useEffect(() => {
    if (!currentShot) return;

    const handleKeyDown = e => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'ArrowLeft' && canGoPrev) {
        e.preventDefault();
        onNavigate(shotList[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        onNavigate(shotList[currentIndex + 1]);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [currentShot, canGoPrev, canGoNext, currentIndex, shotList, onNavigate]);

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
  const modeHintBadgeStyle =
    modeHintVariant === 'browser'
      ? {
          backgroundColor: analyzerUiColors.sourceBadgeWebBg,
          borderColor: analyzerUiColors.sourceBadgeWebBorder,
          color: analyzerUiColors.sourceBadgeWebText,
        }
      : undefined;

  return (
    <div>
      <div className={`transition-all duration-200 ${borderClasses}`}>
        <div
          className='grid w-full items-center px-1.5 py-0.5 sm:px-2'
          style={{
            columnGap: chipGap,
            gridTemplateColumns: hasShot
              ? 'auto minmax(0, 1fr) auto auto'
              : 'auto minmax(0, 1fr) auto',
          }}
        >
          {hasShot ? (
            <button
              className={navButtonClasses}
              disabled={!canGoPrev}
              onClick={() => canGoPrev && onNavigate(shotList[currentIndex - 1])}
              title='Previous shot'
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
          ) : (
            <span aria-hidden='true' className='h-6 w-6 flex-shrink-0' />
          )}

          {hasShot ? (
            <LoadedShotSummary
              chipGap={chipGap}
              currentShot={currentShot}
              currentShotName={currentShotName}
              fieldCls={fieldCls}
              getDurationLabel={getShotDuration(currentShot)}
              notes={notes}
              isEditing={isEditing}
              onToggleNotesExpanded={onToggleNotesExpanded}
            />
          ) : (
            <PlaceholderShotSummary />
          )}

          {hasShot && (
            <button
              className={navButtonClasses}
              disabled={!canGoNext}
              onClick={() => canGoNext && onNavigate(shotList[currentIndex + 1])}
              title='Next shot'
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          )}

          <button
            ref={modeButtonRef}
            type='button'
            className={`${modeButtonClasses} ${importMode === 'browser' ? 'opacity-75' : 'opacity-60'}`}
            style={
              importMode === 'browser' ? { color: analyzerUiColors.sourceBadgeWebText } : undefined
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
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className='bg-primary/20 h-0.5 w-full'>
            <div className='bg-primary h-full w-1/3 animate-pulse rounded-full' />
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
