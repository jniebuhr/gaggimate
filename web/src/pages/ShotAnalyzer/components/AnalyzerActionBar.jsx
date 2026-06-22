/**
 * AnalyzerActionBar.jsx
 * Compact analyzer navigation/import action row below the StatusBar.
 */

/* global globalThis */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEquals } from '@fortawesome/free-solid-svg-icons/faEquals';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faLaptopFile } from '@fortawesome/free-solid-svg-icons/faLaptopFile';
import { analyzerUiColors } from '../utils/analyzerUtils';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';
import { getShotNotesKey } from './useShotNotesState';

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

function getModeHintCopy(nextMode) {
  return nextMode === 'browser'
    ? 'Save to Browser. Imported shots and profiles will now be saved to the browser library.'
    : 'View temporarily. Imported shots and profiles will now open temporarily in the analyzer.';
}

function getAnalyzerActionBarNavigationState({ hasShot, shotList, activeShot, getShotNotesKey }) {
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

function ModeHintPortal({ modeHint, modeHintBadgeStyle, modeHintPosition, modeHintVariant }) {
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

function useAnalyzerActionBarModeHint({ importMode, onImportModeChange }) {
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

function getAnalyzerActionBarDisplayState({ currentShot, selectedShot }) {
  const displayShot = selectedShot || currentShot;
  return {
    displayShot,
    hasDisplayShot: Boolean(displayShot),
  };
}

function getLoadIndicatorTargetProgress({ isSelectionPending, isProfilePending }) {
  if (isSelectionPending) return 0.36;
  if (isProfilePending) return 0.78;
  return 1;
}

function getLoadIndicatorWidth(loadIndicatorVisible, loadIndicatorProgress) {
  if (!loadIndicatorVisible) return '0%';
  return `${Math.min(100, Math.max(loadIndicatorProgress * 100, 8))}%`;
}

function useAnalyzerActionBarLoadIndicator({ isSelectionPending, isProfilePending }) {
  const loadIndicatorHideTimerRef = useRef(null);
  const [loadIndicatorVisible, setLoadIndicatorVisible] = useState(false);
  const [loadIndicatorProgress, setLoadIndicatorProgress] = useState(0);

  const clearLoadIndicatorHideTimer = useCallback(() => {
    if (loadIndicatorHideTimerRef.current) {
      globalThis.clearTimeout(loadIndicatorHideTimerRef.current);
      loadIndicatorHideTimerRef.current = null;
    }
  }, []);

  const isCombinedLoadActive = isSelectionPending || isProfilePending;
  const loadIndicatorTargetProgress = getLoadIndicatorTargetProgress({
    isSelectionPending,
    isProfilePending,
  });

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

  return {
    loadIndicatorVisible,
    loadIndicatorWidth: getLoadIndicatorWidth(loadIndicatorVisible, loadIndicatorProgress),
  };
}

function ActionBarNavigationButtons({
  navButtonClasses,
  canGoPrev,
  canGoNext,
  currentIndex,
  onNavigateToIndex,
}) {
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <button
        type='button'
        className={navButtonClasses}
        disabled={!canGoPrev}
        onClick={() => canGoPrev && onNavigateToIndex(currentIndex - 1, -1)}
        title='Previous shot'
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>

      <button
        type='button'
        className={navButtonClasses}
        disabled={!canGoNext}
        onClick={() => canGoNext && onNavigateToIndex(currentIndex + 1, 1)}
        title='Next shot'
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
}

function ActionBarCompareButton({
  actionButtonClasses,
  compareAvailable,
  compareMode,
  onCompareModeToggle,
}) {
  return (
    <button
      type='button'
      className={`${actionButtonClasses} ${compareMode ? 'text-primary opacity-100' : ''}`}
      disabled={!compareAvailable}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onCompareModeToggle?.();
      }}
      title={compareMode ? 'Disable compare mode' : 'Enable compare mode'}
    >
      <FontAwesomeIcon icon={faEquals} className='text-sm' />
      <span>Compare</span>
    </button>
  );
}

function ActionBarStatisticsAction({
  actionButtonClasses,
  compareMode,
  statisticsAvailable,
  statsHref,
  onShowStats,
}) {
  const statisticsIcon = compareMode ? faChartArea : faChartSimple;
  const content = (
    <>
      <FontAwesomeIcon icon={statisticsIcon} className='text-sm' />
      <span>{compareMode ? 'Multi-Compare' : 'Statistics'}</span>
    </>
  );

  if (statisticsAvailable) {
    return (
      <a
        href={statsHref || '/statistics'}
        className={actionButtonClasses}
        onClick={event => {
          event.stopPropagation();
          onShowStats?.();
        }}
        title='Open statistics'
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type='button'
      className={actionButtonClasses}
      disabled
      title='Load a profile to open statistics'
    >
      {content}
    </button>
  );
}

function ActionBarImportModeToggle({
  actionButtonClasses,
  importMode,
  modeButtonRef,
  handleModeToggle,
}) {
  const isBrowserImportMode = importMode === 'browser';

  return (
    <button
      ref={modeButtonRef}
      type='button'
      className={`${actionButtonClasses} ${isBrowserImportMode ? 'opacity-100' : ''}`}
      style={isBrowserImportMode ? { color: analyzerUiColors.sourceBadgeWebText } : undefined}
      onClick={handleModeToggle}
      title={
        isBrowserImportMode
          ? 'Save to Browser. Click to switch imports to View temporarily.'
          : 'View temporarily. Click to switch imports to Save to Browser.'
      }
      aria-label={
        isBrowserImportMode
          ? 'Switch import mode to View temporarily'
          : 'Switch import mode to Save to Browser'
      }
    >
      <FontAwesomeIcon icon={isBrowserImportMode ? faLaptopFile : faEye} className='text-sm' />
      <span>{isBrowserImportMode ? 'Save' : 'View'}</span>
    </button>
  );
}

const MOBILE_STATUS_ACTIONS_MENU_WIDTH = 224;

function getMobileStatusActionsMenuPosition(anchorElement) {
  if (!anchorElement || !globalThis.window) return { top: 0, left: 12, width: 224 };

  const rect = anchorElement.getBoundingClientRect();
  const viewportWidth = globalThis.window.innerWidth || 0;
  const width = Math.min(MOBILE_STATUS_ACTIONS_MENU_WIDTH, Math.max(0, viewportWidth - 24));
  const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));

  return {
    top: rect.bottom + 8,
    left,
    width,
  };
}

function MobileStatusActionsMenuPortal({
  closeMenu,
  handleImportClick,
  handleModeToggle,
  isBrowserImportMode,
  isImporting,
  menuItemClasses,
  menuPosition,
  menuRef,
  showImportModeToggle,
}) {
  return createPortal(
    <div
      ref={menuRef}
      role='menu'
      className='bg-base-100/95 border-base-content/10 text-base-content fixed z-[10000] rounded-xl border p-1.5 shadow-xl backdrop-blur-md'
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
      }}
    >
      <button
        type='button'
        role='menuitem'
        className={menuItemClasses}
        onClick={event => {
          handleImportClick(event);
          closeMenu();
        }}
        disabled={isImporting}
      >
        <FontAwesomeIcon
          icon={isImporting ? faCircleNotch : faFileImport}
          spin={isImporting}
          className='w-4 text-sm'
        />
        <span>{isImporting ? 'Importing' : 'Import'}</span>
      </button>

      {showImportModeToggle ? (
        <button
          type='button'
          role='menuitem'
          className={menuItemClasses}
          style={isBrowserImportMode ? { color: analyzerUiColors.sourceBadgeWebText } : undefined}
          onClick={event => {
            handleModeToggle(event);
          }}
        >
          <FontAwesomeIcon
            icon={isBrowserImportMode ? faLaptopFile : faEye}
            className='w-4 text-sm'
          />
          <span>{isBrowserImportMode ? 'Save to Browser' : 'View temporarily'}</span>
        </button>
      ) : null}
    </div>,
    document.body,
  );
}

function MobileStatusActionsMenu({
  buttonClasses,
  handleImportClick,
  handleModeToggle,
  importMode,
  isImporting,
  showImportModeToggle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 12, width: 224 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const isBrowserImportMode = importMode === 'browser';

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    setMenuPosition(getMobileStatusActionsMenuPosition(buttonRef.current));
  }, []);

  const toggleMenu = event => {
    event.preventDefault();
    event.stopPropagation();
    updateMenuPosition();
    setIsOpen(current => !current);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = event => {
      const target = event.target;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeMenu();
    };
    const handleResize = () => updateMenuPosition();
    const handleScroll = () => closeMenu();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('resize', handleResize);
    globalThis.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('resize', handleResize);
      globalThis.removeEventListener('scroll', handleScroll, true);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  const menuItemClasses =
    'text-base-content/80 hover:bg-base-content/5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';

  return (
    <div className='ml-auto sm:hidden'>
      <button
        ref={buttonRef}
        type='button'
        className={buttonClasses}
        onClick={toggleMenu}
        aria-label='Open status actions menu'
        aria-expanded={isOpen}
        aria-haspopup='menu'
        title='More actions'
      >
        <FontAwesomeIcon icon={faEllipsisVertical} className='text-sm' />
      </button>

      {isOpen ? (
        <MobileStatusActionsMenuPortal
          closeMenu={closeMenu}
          handleImportClick={handleImportClick}
          handleModeToggle={handleModeToggle}
          isBrowserImportMode={isBrowserImportMode}
          isImporting={isImporting}
          menuItemClasses={menuItemClasses}
          menuPosition={menuPosition}
          menuRef={menuRef}
          showImportModeToggle={showImportModeToggle}
        />
      ) : null}
    </div>
  );
}

function ActionBarImportActions({
  actionButtonClasses,
  handleImportClick,
  handleModeToggle,
  importMode,
  isImporting,
  modeButtonRef,
  showImportModeToggle,
}) {
  return (
    <div className='hidden shrink-0 items-center gap-1 sm:ml-auto sm:flex'>
      <button
        type='button'
        className={actionButtonClasses}
        onClick={handleImportClick}
        disabled={isImporting}
        title='Import shot or profile'
        aria-label={isImporting ? 'Importing shot or profile' : 'Import shot or profile'}
      >
        <FontAwesomeIcon
          icon={isImporting ? faCircleNotch : faFileImport}
          spin={isImporting}
          className='text-sm'
        />
        <span>Import</span>
      </button>

      {showImportModeToggle ? (
        <ActionBarImportModeToggle
          actionButtonClasses={actionButtonClasses}
          importMode={importMode}
          modeButtonRef={modeButtonRef}
          handleModeToggle={handleModeToggle}
        />
      ) : null}
    </div>
  );
}

export function AnalyzerActionBar({
  currentShot,
  selectedShot = null,
  shotList = [],
  onNavigate,
  onCompareModeToggle,
  compareAvailable = false,
  compareMode = false,
  showCompareButton = true,
  onShowStats,
  statsHref = '/statistics',
  statisticsAvailable = true,
  onImport,
  isImporting = false,
  importMode = 'temp',
  onImportModeChange,
  isSelectionPending = false,
  isProfilePending = false,
  showImportModeToggle = true,
  enableKeyboardNavigation = true,
}) {
  const fileInputRef = useRef(null);
  const {
    modeButtonRef,
    modeHint,
    modeHintVariant,
    modeHintPosition,
    modeHintBadgeStyle,
    handleModeToggle,
  } = useAnalyzerActionBarModeHint({
    importMode,
    onImportModeChange,
  });

  const { displayShot, hasDisplayShot } = getAnalyzerActionBarDisplayState({
    currentShot,
    selectedShot,
  });
  const { loadIndicatorVisible, loadIndicatorWidth } = useAnalyzerActionBarLoadIndicator({
    isSelectionPending,
    isProfilePending,
  });

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
  const { currentIndex, canGoPrev, canGoNext } = getAnalyzerActionBarNavigationState({
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

  const borderClasses = 'border-base-content/5 border-t';

  const navButtonClasses = getAnalyzerIconButtonClasses({
    className: 'btn btn-sm btn-ghost h-8 min-h-0 w-8 flex-shrink-0 rounded-lg p-0 text-sm',
  });
  const actionButtonClasses = getAnalyzerIconButtonClasses({
    className:
      'btn btn-sm btn-ghost h-8 min-h-0 flex-shrink-0 gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:opacity-100',
  });

  const handleImportClick = event => {
    event.preventDefault();
    event.stopPropagation();
    if (isImporting) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = event => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onImport?.(files);
      event.target.value = '';
    }
  };

  return (
    <div>
      <div className={`overflow-hidden transition-all duration-200 ${borderClasses}`}>
        <div className='shot-analyzer-action-scroll shot-analyzer-status-actions flex w-full items-center gap-1.5 overflow-x-auto overflow-y-hidden px-1.5 py-1 sm:px-2'>
          <ActionBarNavigationButtons
            navButtonClasses={navButtonClasses}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            currentIndex={currentIndex}
            onNavigateToIndex={handleNavigateToIndex}
          />

          {showCompareButton ? (
            <ActionBarCompareButton
              actionButtonClasses={actionButtonClasses}
              compareAvailable={compareAvailable}
              compareMode={compareMode}
              onCompareModeToggle={onCompareModeToggle}
            />
          ) : null}

          <ActionBarStatisticsAction
            actionButtonClasses={actionButtonClasses}
            compareMode={compareMode}
            statisticsAvailable={statisticsAvailable}
            statsHref={statsHref}
            onShowStats={onShowStats}
          />

          <MobileStatusActionsMenu
            buttonClasses={`${actionButtonClasses} px-2.5 sm:hidden`}
            handleImportClick={handleImportClick}
            handleModeToggle={handleModeToggle}
            importMode={importMode}
            isImporting={isImporting}
            showImportModeToggle={showImportModeToggle}
          />

          <ActionBarImportActions
            actionButtonClasses={actionButtonClasses}
            handleImportClick={handleImportClick}
            handleModeToggle={handleModeToggle}
            importMode={importMode}
            isImporting={isImporting}
            modeButtonRef={modeButtonRef}
            showImportModeToggle={showImportModeToggle}
          />

          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept='.slog,.json'
            onChange={handleFileSelect}
            className='hidden'
            disabled={isImporting}
          />
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

      <ModeHintPortal
        modeHint={modeHint}
        modeHintBadgeStyle={modeHintBadgeStyle}
        modeHintPosition={modeHintPosition}
        modeHintVariant={modeHintVariant}
      />
    </div>
  );
}
