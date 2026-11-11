/** Coordinates analyzer navigation, import actions, status hints, and loading state. */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { getAnalyzerIconButtonClasses } from '../analyzerControlStyles';
import { getShotNotesKey } from '../useShotNotesState';
import {
  ActionBarCompareButton,
  ActionBarImportActions,
  ActionBarNavigationButtons,
  ActionBarStatisticsAction,
} from './ActionBarButtons';
import { ModeHintPortal, useAnalyzerActionBarModeHint } from './ActionBarModeHint';
import { MobileStatusActionsMenu } from './MobileStatusActionsMenu';
import {
  getAnalyzerActionBarDisplayState,
  getAnalyzerActionBarNavigationState,
  isTypingTarget,
} from './actionBarState';
import { useAnalyzerActionBarLoadIndicator } from './useActionBarLoadIndicator';

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
        debounceMs: 0,
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
