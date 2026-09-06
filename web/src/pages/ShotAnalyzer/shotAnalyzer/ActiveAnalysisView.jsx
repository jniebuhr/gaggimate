/** Renders the responsive chart, details, and analysis-table composition. */

/* global globalThis */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { AnalysisTable } from '../components/AnalysisTable';
import { ShotChart } from '../components/ShotChart';
import { ShotDetailsPanel, ShotMobilePrimaryCards } from '../components/ShotDetailsPanel';

export function buildShotDetailsEntries({
  isCompareActive,
  compareCollectionWithAccents,
  referenceCompareEntry,
}) {
  if (isCompareActive) return compareCollectionWithAccents;
  if (!referenceCompareEntry) return [];

  return [
    {
      ...referenceCompareEntry,
      accentColor: 'var(--color-primary)',
      accentStrength: 1,
    },
  ];
}

export function resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight) {
  setDesktopSingleDetailsHeight(prev => (prev === 0 ? prev : 0));
}

export function getDesktopSingleChartStyle(singleDesktopDetailsHeight) {
  if (!singleDesktopDetailsHeight) return undefined;
  return { height: `${singleDesktopDetailsHeight}px` };
}

function getActiveAnalysisViewClasses(isCompareActive) {
  return {
    desktopStickyDetailsClass: isCompareActive ? 'analyzer-shot-details-sticky' : '',
    compareShellClass: isCompareActive ? 'shot-chart-card-shell--compare' : '',
    chartSurfaceClass: isCompareActive
      ? ''
      : 'app-card-surface rounded-xl px-1.5 py-2 sm:px-2 lg:h-full',
    mobilePrimaryShellClass: isCompareActive
      ? ''
      : 'analyzer-mobile-stack-layer analyzer-mobile-stack-layer--primary',
    singleShellClass: isCompareActive
      ? ''
      : 'analyzer-mobile-stack-layer analyzer-mobile-stack-layer--chart',
    mobileDetailsShellClass: isCompareActive
      ? 'hidden lg:block'
      : 'analyzer-mobile-stack-layer analyzer-mobile-stack-layer--details',
  };
}

export function getCompareDetailsKey(isCompareActive, shotDetailsEntries) {
  if (!isCompareActive) return '';
  return shotDetailsEntries
    .map((entry, index) => entry?.key || entry?.shot?.id || entry?.shotName || index)
    .join('|');
}

function MobileAnalyzerSubpageHeader({ onBack, subtitle, title }) {
  return (
    <div className='flex items-center gap-3'>
      <button
        type='button'
        className='app-card-surface text-base-content/75 hover:text-base-content flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors'
        onClick={onBack}
        aria-label='Back to analyzer'
      >
        <FontAwesomeIcon icon={faChevronLeft} aria-hidden='true' />
      </button>
      <div className='min-w-0'>
        <div className='text-base-content text-sm font-semibold'>{title}</div>
        <div className='text-base-content/55 truncate text-xs'>{subtitle}</div>
      </div>
    </div>
  );
}

function MobileAnalyzerSubpageAction({ label, onClick }) {
  return (
    <button
      type='button'
      className='app-card-surface hover:bg-base-200/60 relative z-0 flex min-h-14 w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left transition-colors'
      onClick={onClick}
    >
      <span className='text-base-content text-sm font-semibold'>{label}</span>
      <FontAwesomeIcon
        icon={faChevronRight}
        className='text-base-content/45 text-xs'
        aria-hidden='true'
      />
    </button>
  );
}

function getMobileAnalyzerSubpageMeta({ isCompareActive, showMobileAnalysisPage }) {
  if (!showMobileAnalysisPage) {
    return { subtitle: 'Compare shot details', title: 'Notes' };
  }
  return {
    subtitle: isCompareActive ? 'Compare analysis table' : 'Shot analysis table',
    title: 'Analysis Table',
  };
}

function getVerticalScrollContainer(element) {
  const browserWindow = globalThis.window;
  if (!browserWindow || !element) return null;

  let currentElement = element.parentElement;
  while (currentElement) {
    const overflowY = browserWindow.getComputedStyle(currentElement).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return currentElement;
    }
    currentElement = currentElement.parentElement;
  }

  return browserWindow.document.scrollingElement;
}

function scheduleAfterLayout(callback) {
  const browserWindow = globalThis.window;
  if (!browserWindow) {
    callback();
    return () => {};
  }

  const frameId = browserWindow.requestAnimationFrame(callback);
  return () => browserWindow.cancelAnimationFrame(frameId);
}

function scheduleAcrossLayoutFrames(callback) {
  let cancelFinalFrame = () => {};
  const cancelInitialFrame = scheduleAfterLayout(() => {
    callback();
    cancelFinalFrame = scheduleAfterLayout(callback);
  });

  return () => {
    cancelInitialFrame();
    cancelFinalFrame();
  };
}

function AnalyzerTable({
  activeColumns,
  analysisResults,
  compareCollectionWithAccents,
  isCompareActive,
  setActiveColumns,
}) {
  return (
    <AnalysisTable
      results={analysisResults}
      compareEntries={compareCollectionWithAccents}
      isCompareActive={isCompareActive}
      activeColumns={activeColumns}
      onColumnsChange={setActiveColumns}
    />
  );
}

export function ActiveAnalysisView({
  activeColumns,
  analysisResults,
  analysisSectionRef,
  chartMountKey,
  compareCollectionWithAccents,
  compareTargetDisplayMode,
  currentShot,
  currentProfile,
  handleSwapCompareSlots,
  isCompareActive,
  mobileSubpageNavigation,
  setActiveColumns,
  setCompareTargetDisplayMode,
  shotDetailsColumnRef,
  shotDetailsEntries,
  singleDesktopChartStyle,
  singleDesktopDetailsHeight,
}) {
  const alignmentClass = 'lg:items-start';
  const {
    desktopStickyDetailsClass,
    compareShellClass,
    chartSurfaceClass,
    mobilePrimaryShellClass,
    singleShellClass,
    mobileDetailsShellClass,
  } = getActiveAnalysisViewClasses(isCompareActive);
  const [activeCompareDetailsIndex, setActiveCompareDetailsIndex] = useState(0);
  const mobileSubpageRef = useRef(null);
  const mobileSubpageReturnScrollRef = useRef(null);
  const wasMobileSubpageOpenRef = useRef(false);
  const compareDetailsKey = getCompareDetailsKey(isCompareActive, shotDetailsEntries);
  const { closeMobileSubpage, mobileSubpage, openMobileSubpage } = mobileSubpageNavigation;
  const showCompareMobileDetailsPage = isCompareActive && mobileSubpage === 'notes';
  const showMobileAnalysisPage = mobileSubpage === 'analysis' && Boolean(analysisResults);
  const showMobileSubpage = showCompareMobileDetailsPage || showMobileAnalysisPage;
  const mobileSubpageMeta = getMobileAnalyzerSubpageMeta({
    isCompareActive,
    showMobileAnalysisPage,
  });

  useEffect(() => {
    setActiveCompareDetailsIndex(0);
  }, [compareDetailsKey, isCompareActive]);

  useLayoutEffect(() => {
    if (showMobileSubpage) {
      wasMobileSubpageOpenRef.current = true;
      return scheduleAcrossLayoutFrames(() => {
        mobileSubpageRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }

    if (!wasMobileSubpageOpenRef.current) return undefined;
    wasMobileSubpageOpenRef.current = false;
    const savedScroll = mobileSubpageReturnScrollRef.current;
    if (!savedScroll?.container) return undefined;

    return scheduleAcrossLayoutFrames(() => {
      savedScroll.container.scrollTop = savedScroll.top;
    });
  }, [showMobileSubpage]);

  const handleOpenMobileSubpage = useCallback(
    page => {
      const scrollContainer = getVerticalScrollContainer(analysisSectionRef.current);
      mobileSubpageReturnScrollRef.current = scrollContainer
        ? { container: scrollContainer, top: scrollContainer.scrollTop }
        : null;
      openMobileSubpage(page);
    },
    [analysisSectionRef, openMobileSubpage],
  );

  return (
    <div ref={analysisSectionRef} className='analyzer-mobile-scroll-target animate-fade-in mt-8'>
      {showMobileSubpage ? (
        <div ref={mobileSubpageRef} className='analyzer-mobile-scroll-target space-y-3 lg:hidden'>
          <MobileAnalyzerSubpageHeader
            onBack={closeMobileSubpage}
            title={mobileSubpageMeta.title}
            subtitle={mobileSubpageMeta.subtitle}
          />
          {showCompareMobileDetailsPage ? (
            <ShotDetailsPanel
              entries={shotDetailsEntries}
              isCompareActive={isCompareActive}
              activeCompareIndex={activeCompareDetailsIndex}
              onActiveCompareIndexChange={setActiveCompareDetailsIndex}
            />
          ) : null}
          {showMobileAnalysisPage ? (
            <AnalyzerTable
              activeColumns={activeColumns}
              analysisResults={analysisResults}
              compareCollectionWithAccents={compareCollectionWithAccents}
              isCompareActive={isCompareActive}
              setActiveColumns={setActiveColumns}
            />
          ) : null}
        </div>
      ) : null}

      <div className={showMobileSubpage ? 'hidden lg:block' : ''}>
        <div
          className={`grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14.5rem,17rem)] xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] ${alignmentClass}`}
        >
          <div className='order-1 min-w-0 lg:order-1'>
            {!isCompareActive && shotDetailsEntries[0]?.shot ? (
              <div className={mobilePrimaryShellClass}>
                <ShotMobilePrimaryCards entry={shotDetailsEntries[0]} />
              </div>
            ) : null}
            <div
              key={chartMountKey}
              className={`shot-chart-card-shell ${chartSurfaceClass} ${compareShellClass} ${singleShellClass}`}
              style={singleDesktopChartStyle}
            >
              <ShotChart
                shotData={currentShot}
                profileData={currentProfile}
                results={analysisResults}
                compareEntries={compareCollectionWithAccents}
                isCompareActive={isCompareActive}
                desktopCardHeight={singleDesktopDetailsHeight}
                onCompareSwap={handleSwapCompareSlots}
                compareTargetDisplayMode={compareTargetDisplayMode}
                onCompareTargetDisplayModeChange={setCompareTargetDisplayMode}
              />
            </div>
          </div>
          <div
            ref={shotDetailsColumnRef}
            className={`order-2 min-w-0 lg:order-2 ${desktopStickyDetailsClass} ${mobileDetailsShellClass}`}
          >
            <ShotDetailsPanel
              entries={shotDetailsEntries}
              isCompareActive={isCompareActive}
              activeCompareIndex={activeCompareDetailsIndex}
              onActiveCompareIndexChange={setActiveCompareDetailsIndex}
            />
          </div>
        </div>

        {isCompareActive ? (
          <div className='analyzer-mobile-stack-layer analyzer-mobile-stack-layer--details mt-3 lg:hidden'>
            <MobileAnalyzerSubpageAction
              label='Notes'
              onClick={() => handleOpenMobileSubpage('notes')}
            />
          </div>
        ) : null}

        {analysisResults ? (
          <>
            <div className='analyzer-mobile-stack-layer analyzer-mobile-stack-layer--analysis mt-3 lg:hidden'>
              <MobileAnalyzerSubpageAction
                label='Analysis Table'
                onClick={() => handleOpenMobileSubpage('analysis')}
              />
            </div>
            <div className='analyzer-analysis-shell mt-4 hidden lg:block'>
              <AnalyzerTable
                activeColumns={activeColumns}
                analysisResults={analysisResults}
                compareCollectionWithAccents={compareCollectionWithAccents}
                isCompareActive={isCompareActive}
                setActiveColumns={setActiveColumns}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
