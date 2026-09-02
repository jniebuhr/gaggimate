/* global globalThis */

/** Composes responsive legend, replay/export, and compare controls for shot charts. */

import { useEffect, useState } from 'preact/hooks';
import { LEGEND_ORDER } from '../constants';
import { COMPARE_TARGET_DISPLAY_MODES } from '../../../utils/analyzerUtils';
import {
  ANALYZER_ACTION_ICON_BUTTON_CLASS,
  getAnalyzerIconButtonClasses,
} from '../../analyzerControlStyles';
import { ChartLegendArea } from './chartLegendControls';
import { CompareControlsRow } from './compareControls';
import { ChartActionGroup, ReplayExportStatus } from './chartReplayControls';

function getInitialIsMobileControls() {
  return Boolean(globalThis.window && globalThis.window.innerWidth < 1024);
}

function useIsMobileControls() {
  const [isMobile, setIsMobile] = useState(getInitialIsMobileControls);

  useEffect(() => {
    const mediaQuery = globalThis.window?.matchMedia?.('(max-width: 1023px)');
    if (mediaQuery) {
      const handleChange = event => {
        setIsMobile(event.matches);
      };
      setIsMobile(mediaQuery.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    return undefined;
  }, []);

  return isMobile;
}

function ReplayFocusHint({ isCompareMode, shouldShowReplayFocusHint }) {
  if (!isCompareMode && shouldShowReplayFocusHint) {
    return (
      <div className='mb-2 px-1'>
        <div className='border-base-content/10 bg-base-100/70 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-[var(--analyzer-warning-orange)] shadow-sm'>
          Keep this window focused while the replay is being recorded.
        </div>
      </div>
    );
  }

  return null;
}

export function ShotChartControls({
  exportMenuRef,
  exportMenuState,
  hasWeightData,
  hasWeightFlowData,
  hasVideoExportSupport,
  isControlsLocked,
  isFullDisplay,
  isReplayPaused,
  isReplaying,
  isReplayExporting,
  isVideoExportActive,
  legendColorByLabel,
  hiddenLegendLabels = [],
  compareShotLegendItems = [],
  compareAlignmentMode = 'shotStart',
  compareAlignmentOptions = [],
  onCompareAlignmentModeChange = null,
  onCompareSwap = null,
  compareTargetDisplayMode = COMPARE_TARGET_DISPLAY_MODES.PER_SHOT,
  onCompareTargetDisplayModeChange = null,
  showCompareAnnotationToggle = false,
  compareAnnotationsEnabled = false,
  onCompareAnnotationsToggle = null,
  isCompareMode = false,
  topLegendLabels = null,
  showExportButton = true,
  showFullDisplayButton = true,
  showMobileLegend = true,
  hideCompareControlsRowOnMobile = false,
  showReplayButton = true,
  showStopButton = true,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  profileExportAvailable,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onFullDisplayToggle,
  onIncludeLegendChange,
  onLegendToggle,
  onReplayToggle,
  onStop,
  replayExportStatus,
  replayExportStatusHint,
  replayExportStatusLabel,
  shouldShowReplayFocusHint,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
  separateMobileReplayActions = false,
  visibility,
}) {
  const isMobile = useIsMobileControls();
  const chartActionButtonClasses = getAnalyzerIconButtonClasses({
    className: `${ANALYZER_ACTION_ICON_BUTTON_CLASS} border-0 bg-transparent shadow-none`,
  });
  const shouldShowCompareControls =
    isCompareMode &&
    (compareShotLegendItems.length > 0 ||
      onCompareAlignmentModeChange ||
      onCompareTargetDisplayModeChange ||
      (showCompareAnnotationToggle && onCompareAnnotationsToggle));
  const visibleTopLegendLabels = topLegendLabels || LEGEND_ORDER;
  const visibleMobileLegendLabels = topLegendLabels || ['Phases', 'Stops'];
  const hiddenMobileLegendLabels = topLegendLabels
    ? []
    : LEGEND_ORDER.filter(label => label !== 'Phases' && label !== 'Stops');

  return (
    <>
      {/* Keep the control bar extracted so ShotChart.jsx can focus on chart lifecycle and replay logic. */}
      <div className='flex flex-wrap items-center gap-2'>
        <ChartLegendArea
          hiddenLegendLabels={hiddenLegendLabels}
          hiddenMobileLegendLabels={hiddenMobileLegendLabels}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={isControlsLocked}
          isMobile={isMobile}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={onLegendToggle}
          showMobileLegend={showMobileLegend}
          visibleMobileLegendLabels={visibleMobileLegendLabels}
          visibleTopLegendLabels={visibleTopLegendLabels}
          visibility={visibility}
        />

        <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
          <ChartActionGroup
            chartActionButtonClasses={chartActionButtonClasses}
            exportMenuRef={exportMenuRef}
            exportMenuState={exportMenuState}
            hasVideoExportSupport={hasVideoExportSupport}
            isCompareMode={isCompareMode}
            isControlsLocked={isControlsLocked}
            isFullDisplay={isFullDisplay}
            isMobile={isMobile}
            isReplayPaused={isReplayPaused}
            isReplaying={isReplaying}
            isReplayExporting={isReplayExporting}
            isVideoExportActive={isVideoExportActive}
            onCloseExportMenu={onCloseExportMenu}
            onExportAction={onExportAction}
            onExportMenuToggle={onExportMenuToggle}
            profileExportAvailable={profileExportAvailable}
            onExportTypeChange={onExportTypeChange}
            onExportFormatChange={onExportFormatChange}
            onExportFormatInfoToggle={onExportFormatInfoToggle}
            onFullDisplayToggle={onFullDisplayToggle}
            onIncludeLegendChange={onIncludeLegendChange}
            onReplayToggle={onReplayToggle}
            onStop={onStop}
            shouldLockWebmToggle={shouldLockWebmToggle}
            shouldShowWebmToggle={shouldShowWebmToggle}
            showExportButton={showExportButton && !(separateMobileReplayActions && isMobile)}
            showFullDisplayButton={showFullDisplayButton}
            showReplayButton={showReplayButton && !(separateMobileReplayActions && isMobile)}
            showStopButton={showStopButton && !(separateMobileReplayActions && isMobile)}
          />
          {separateMobileReplayActions && isMobile ? null : (
            <ReplayExportStatus
              replayExportStatus={replayExportStatus}
              replayExportStatusHint={replayExportStatusHint}
              replayExportStatusLabel={replayExportStatusLabel}
            />
          )}
        </div>
      </div>

      <CompareControlsRow
        compareAlignmentMode={compareAlignmentMode}
        compareAlignmentOptions={compareAlignmentOptions}
        compareAnnotationsEnabled={compareAnnotationsEnabled}
        compareShotLegendItems={compareShotLegendItems}
        compareTargetDisplayMode={compareTargetDisplayMode}
        onCompareAlignmentModeChange={onCompareAlignmentModeChange}
        onCompareAnnotationsToggle={onCompareAnnotationsToggle}
        onCompareSwap={onCompareSwap}
        onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        shouldShowCompareControls={
          shouldShowCompareControls && !(hideCompareControlsRowOnMobile && isMobile)
        }
        showCompareAnnotationToggle={showCompareAnnotationToggle}
      />

      <ReplayFocusHint
        isCompareMode={isCompareMode}
        shouldShowReplayFocusHint={shouldShowReplayFocusHint}
      />
    </>
  );
}
