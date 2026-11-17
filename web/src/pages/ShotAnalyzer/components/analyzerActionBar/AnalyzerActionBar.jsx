/** Coordinates analyzer navigation, import actions, status hints, and loading state. */

import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { t } from '@lingui/core/macro';
import { LibraryActionsMenu } from '../library/LibraryActionsMenu';
import { useCallback, useEffect, useRef } from 'preact/hooks';
import { getAnalyzerIconButtonClasses } from '../analyzerControlStyles';
import { getShotNotesKey } from '../useShotNotesState';
import {
  ActionBarCompareButton,
  ActionBarImportActions,
  ActionBarNavigationButtons,
  ActionBarStatisticsAction,
} from './ActionBarButtons';
import {
  getAnalyzerActionBarDisplayState,
  getAnalyzerActionBarNavigationState,
  isTypingTarget,
} from './actionBarState';
import { useAnalyzerActionBarLoadIndicator } from './useActionBarLoadIndicator';

export function AnalyzerActionBar({
  currentShot,
  shotActions = [],
  entryMode = false,
  isMobileViewport = false,
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
  isSelectionPending = false,
  isProfilePending = false,
  enableKeyboardNavigation = true,
}) {
  const fileInputRef = useRef(null);
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
    if (!displayShot || !enableKeyboardNavigation || entryMode) return;

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
    entryMode,
    canGoPrev,
    canGoNext,
    currentIndex,
    handleNavigateToIndex,
    enableKeyboardNavigation,
  ]);

  const menuActions = isMobileViewport
    ? [
        {
          label: compareMode ? t`Multi-Compare` : t`Profile Stats`,
          icon: compareMode ? faChartArea : faChartSimple,
          href: statisticsAvailable ? statsHref || '/statistics' : undefined,
          onSelect: onShowStats,
          disabled: !statisticsAvailable,
        },
        ...shotActions,
      ]
    : shotActions;

  const borderClasses = 'border-base-content/5 border-t';

  const navButtonClasses = getAnalyzerIconButtonClasses({
    className: 'btn btn-sm btn-ghost h-8 min-h-0 w-8 flex-shrink-0 rounded-lg p-0 text-sm',
  });
  const actionButtonClasses = getAnalyzerIconButtonClasses({
    className: `btn btn-sm btn-ghost h-8 min-h-0 flex-shrink-0 gap-1.5 rounded-lg font-medium hover:opacity-100 ${entryMode ? 'px-1.5 text-xs sm:px-2.5 sm:text-sm' : 'px-2.5 text-sm'}`,
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
    <div className={entryMode ? 'contents' : undefined}>
      <div
        className={
          entryMode ? 'contents' : `overflow-hidden transition-all duration-200 ${borderClasses}`
        }
      >
        <div
          className={
            entryMode
              ? 'flex items-center gap-1'
              : 'shot-analyzer-action-scroll shot-analyzer-status-actions flex w-full items-center gap-1.5 overflow-x-auto overflow-y-hidden px-1.5 py-1 sm:px-2'
          }
        >
          {!entryMode && (
            <ActionBarNavigationButtons
              navButtonClasses={navButtonClasses}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              currentIndex={currentIndex}
              onNavigateToIndex={handleNavigateToIndex}
            />
          )}

          {showCompareButton ? (
            <ActionBarCompareButton
              actionButtonClasses={actionButtonClasses}
              compareAvailable={compareAvailable}
              compareMode={compareMode}
              onCompareModeToggle={onCompareModeToggle}
            />
          ) : null}

          {!entryMode && !isMobileViewport && (
            <ActionBarStatisticsAction
              actionButtonClasses={actionButtonClasses}
              compareMode={compareMode}
              statisticsAvailable={statisticsAvailable}
              statsHref={statsHref}
              onShowStats={onShowStats}
            />
          )}

          <ActionBarImportActions
            actionButtonClasses={actionButtonClasses}
            handleImportClick={handleImportClick}
            isImporting={isImporting}
          />

          {!entryMode && shotActions.length > 0 && (
            <LibraryActionsMenu
              actions={menuActions}
              ariaLabel={t`Open shot actions menu`}
              label={t`More`}
              buttonClassName='h-8 w-8 shrink-0 p-1.5 text-sm font-medium lg:w-auto lg:gap-1.5 lg:px-2.5'
            />
          )}

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

        {!entryMode && loadIndicatorVisible && (
          <div className='bg-primary/15 h-0.5 w-full overflow-hidden'>
            <div
              className='bg-primary h-full rounded-full transition-[width] duration-200 ease-out'
              style={{ width: loadIndicatorWidth }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
