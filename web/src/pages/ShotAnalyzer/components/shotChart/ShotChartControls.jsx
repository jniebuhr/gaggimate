/* global globalThis */

import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowRightArrowLeft';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faDownLeftAndUpRightToCenter } from '@fortawesome/free-solid-svg-icons/faDownLeftAndUpRightToCenter';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faPhotoFilm } from '@fortawesome/free-solid-svg-icons/faPhotoFilm';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faStop } from '@fortawesome/free-solid-svg-icons/faStop';
import { faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons/faUpRightAndDownLeftFromCenter';
import {
  LEGEND_BLOCK_LABELS,
  LEGEND_DASHED_LABELS,
  LEGEND_ORDER,
  LEGEND_THIN_LINE_LABELS,
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
} from './constants';
import { COMPARE_TARGET_DISPLAY_MODES } from '../../utils/analyzerUtils';
import {
  ANALYZER_ACTION_GROUP_CLASSES,
  ANALYZER_ACTION_ICON_BUTTON_CLASS,
  ANALYZER_ACTION_ICON_CLASS,
  ANALYZER_ACTION_ICON_STYLE,
  ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS,
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from '../analyzerControlStyles';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from './labelVisuals';

const LEGEND_BUTTON_BASE_CLASS =
  'text-base-content inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded px-1.5 text-xs leading-tight font-normal tracking-normal normal-case transition disabled:cursor-not-allowed disabled:opacity-35';
const LEGEND_ICON_CLASS = 'text-xs';
export const SHOT_CHART_PRIMARY_LEGEND_LABELS = ['Phases', 'Stops'];
export const SHOT_CHART_SERIES_LEGEND_LABELS = LEGEND_ORDER.filter(
  label => !SHOT_CHART_PRIMARY_LEGEND_LABELS.includes(label),
);

function renderLegendMarker({ label, labelIcon, swatchColor, swatchLineWidth }) {
  if (LEGEND_BLOCK_LABELS.has(label)) {
    const markerColor = label === 'Phases' ? 'var(--color-base-content)' : swatchColor;
    return <span className='h-3 w-3 rounded-full' style={{ backgroundColor: markerColor }} />;
  }

  if (labelIcon) {
    return (
      <FontAwesomeIcon
        icon={labelIcon}
        className={LEGEND_ICON_CLASS}
        style={{ color: swatchColor }}
        aria-hidden='true'
      />
    );
  }

  return (
    <span
      className={`block w-4 border-t ${LEGEND_DASHED_LABELS.has(label) ? 'border-dashed' : 'border-solid'}`}
      style={{ borderColor: swatchColor, borderTopWidth: `${swatchLineWidth}px` }}
    />
  );
}
function getReplayActionLabel({ isReplaying, isReplayPaused }) {
  if (isReplaying) return 'Pause replay';
  if (isReplayPaused) return 'Resume replay';
  return 'Replay chart';
}

function ChartActionDivider() {
  return <span className='bg-base-content/15 mx-1 h-4 w-px shrink-0' aria-hidden='true' />;
}

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

function getRenderableLegendLabels({
  labels,
  hiddenLegendLabels,
  hasWeightData,
  hasWeightFlowData,
}) {
  return labels.filter(label => {
    if (hiddenLegendLabels.includes(label)) return false;
    if (label === 'Weight' && !hasWeightData) return false;
    if (label === 'Weight Flow' && !hasWeightFlowData) return false;
    return true;
  });
}

export function ShotChartLegendToggles({
  labels = LEGEND_ORDER,
  hiddenLegendLabels = [],
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  visibility,
  className = 'flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5',
}) {
  const renderableLabels = getRenderableLegendLabels({
    labels,
    hiddenLegendLabels,
    hasWeightData,
    hasWeightFlowData,
  });

  if (renderableLabels.length === 0) return null;

  return (
    <div className={className}>
      {renderableLabels.map(label => {
        const key = VISIBILITY_KEY_BY_LABEL[label];
        const isVisible = key ? visibility[key] : false;
        const swatchColor = legendColorByLabel[label] || '#94a3b8';
        const swatchLineWidth = LEGEND_THIN_LINE_LABELS.has(label)
          ? THIN_LINE_WIDTH
          : STANDARD_LINE_WIDTH;
        const labelIcon = getShotChartLabelIcon(label);
        const displayLabel = getShotChartDisplayLabel(label);

        return (
          <button
            key={label}
            type='button'
            onClick={() => onLegendToggle(label)}
            aria-pressed={isVisible}
            disabled={isControlsLocked}
            className={`${LEGEND_BUTTON_BASE_CLASS} ${
              isVisible
                ? 'hover:bg-base-content/5 opacity-90'
                : 'hover:bg-base-content/5 hover:text-primary opacity-45 hover:opacity-75'
            }`}
          >
            {renderLegendMarker({ label, labelIcon, swatchColor, swatchLineWidth })}
            <span>{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function ShotMediaExportMenu({
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isControlsLocked,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onIncludeLegendChange,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
  buttonClassName,
  buttonIconClassName = ANALYZER_ACTION_ICON_CLASS,
  buttonIconStyle = ANALYZER_ACTION_ICON_STYLE,
  menuClassName = 'absolute top-full right-0 z-[70] mt-2',
}) {
  return (
    <div ref={exportMenuRef} className='relative flex'>
      <button
        type='button'
        onClick={onExportMenuToggle}
        className={`${buttonClassName} ${exportMenuState.open ? 'text-base-content/90' : ''}`}
        disabled={isControlsLocked}
        aria-label='Open media export menu'
        aria-expanded={exportMenuState.open}
        title='Open media export menu'
      >
        <FontAwesomeIcon
          icon={faPhotoFilm}
          className={buttonIconClassName}
          style={buttonIconStyle}
        />
      </button>
      {exportMenuState.open ? (
        <div
          className={`bg-base-100/95 border-base-content/10 w-[min(92vw,15rem)] rounded-xl border p-3 text-[12px] shadow-xl backdrop-blur-md ${menuClassName}`}
        >
          <div className='mb-2 text-xs font-medium opacity-60'>Export Chart</div>
          <div className='space-y-1'>
            {[
              {
                value: 'video',
                label: hasVideoExportSupport ? 'Video' : 'Video (unsupported)',
                disabled: !hasVideoExportSupport,
              },
              { value: 'image', label: 'Image' },
            ].map(option => (
              <label
                key={option.value}
                className={`${
                  option.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : getAnalyzerSurfaceTriggerClasses({
                        className: 'flex cursor-pointer items-center gap-2 px-2 py-1.5',
                      })
                }`}
              >
                <input
                  type='radio'
                  name='shot-chart-export-type'
                  className='radio radio-xs'
                  checked={exportMenuState.exportType === option.value}
                  disabled={option.disabled}
                  onChange={() => onExportTypeChange(option.value)}
                />
                <span className='text-sm'>{option.label}</span>
              </label>
            ))}
          </div>
          <label
            className={getAnalyzerSurfaceTriggerClasses({
              className: 'mt-2 flex cursor-pointer items-center gap-2 px-2 py-1.5',
            })}
          >
            <input
              type='checkbox'
              className='toggle toggle-primary toggle-xs'
              checked={exportMenuState.includeLegend}
              onChange={event => onIncludeLegendChange(event.currentTarget.checked)}
            />
            <span className='text-sm'>Include legend</span>
          </label>
          {exportMenuState.exportType === 'video' && shouldShowWebmToggle ? (
            <div
              className={getAnalyzerSurfaceTriggerClasses({
                className: 'mt-1 px-2 py-1.5',
              })}
            >
              <div className='flex items-center gap-2'>
                <label className='flex min-w-0 flex-1 cursor-pointer items-center gap-2'>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary toggle-xs'
                    checked={exportMenuState.exportFormat === 'webm'}
                    disabled={shouldLockWebmToggle}
                    onChange={event =>
                      onExportFormatChange(event.currentTarget.checked ? 'webm' : 'mp4')
                    }
                  />
                  <span className='text-sm'>Export as WebM</span>
                </label>
                <button
                  type='button'
                  onClick={onExportFormatInfoToggle}
                  className={getAnalyzerIconButtonClasses({
                    className: 'h-6 min-h-0 w-6 p-0',
                  })}
                  aria-label='Explain WebM export'
                  aria-expanded={exportMenuState.showFormatInfo}
                  title='Explain WebM export'
                >
                  <FontAwesomeIcon icon={faCircleInfo} className='text-xs opacity-70' />
                </button>
              </div>
              {exportMenuState.showFormatInfo ? (
                <p className='text-base-content/70 mt-2 pr-1 text-xs leading-relaxed'>
                  {shouldLockWebmToggle
                    ? 'This browser records replay video as WebM natively.'
                    : 'WebM is the recommended replay video format in browsers with native WebM recording support.'}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className='mt-3 flex items-center justify-end gap-2'>
            <button
              type='button'
              onClick={onCloseExportMenu}
              className={getAnalyzerTextButtonClasses({
                className: 'h-7 min-h-0 px-2.5 text-xs font-medium',
              })}
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={onExportAction}
              className='btn btn-primary btn-xs h-7 min-h-0 px-2.5'
            >
              Export
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileLegendArea({
  hiddenLegendLabels,
  hiddenMobileLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  showMobileLegend,
  visibleMobileLegendLabels,
  visibility,
}) {
  if (showMobileLegend) {
    return (
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <ShotChartLegendToggles
          labels={visibleMobileLegendLabels}
          hiddenLegendLabels={[...hiddenLegendLabels, ...hiddenMobileLegendLabels]}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={isControlsLocked}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={onLegendToggle}
          visibility={visibility}
        />
      </div>
    );
  }

  return <div className='min-w-0 flex-1' />;
}

function DesktopLegendArea({
  hiddenLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  visibleTopLegendLabels,
  visibility,
}) {
  return (
    <ShotChartLegendToggles
      labels={visibleTopLegendLabels}
      hiddenLegendLabels={hiddenLegendLabels}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      isControlsLocked={isControlsLocked}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={onLegendToggle}
      visibility={visibility}
      className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5'
    />
  );
}

function ChartLegendArea({
  hiddenLegendLabels,
  hiddenMobileLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  isMobile,
  legendColorByLabel,
  onLegendToggle,
  showMobileLegend,
  visibleMobileLegendLabels,
  visibleTopLegendLabels,
  visibility,
}) {
  if (isMobile) {
    return (
      <MobileLegendArea
        hiddenLegendLabels={hiddenLegendLabels}
        hiddenMobileLegendLabels={hiddenMobileLegendLabels}
        hasWeightData={hasWeightData}
        hasWeightFlowData={hasWeightFlowData}
        isControlsLocked={isControlsLocked}
        legendColorByLabel={legendColorByLabel}
        onLegendToggle={onLegendToggle}
        showMobileLegend={showMobileLegend}
        visibleMobileLegendLabels={visibleMobileLegendLabels}
        visibility={visibility}
      />
    );
  }

  return (
    <DesktopLegendArea
      hiddenLegendLabels={hiddenLegendLabels}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      isControlsLocked={isControlsLocked}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={onLegendToggle}
      visibleTopLegendLabels={visibleTopLegendLabels}
      visibility={visibility}
    />
  );
}

function ReplayActionButton({
  chartActionButtonClasses,
  isControlsLocked,
  isReplayPaused,
  isReplaying,
  onReplayToggle,
}) {
  const replayActionLabel = getReplayActionLabel({ isReplaying, isReplayPaused });

  return (
    <button
      type='button'
      onClick={onReplayToggle}
      className={chartActionButtonClasses}
      disabled={isControlsLocked}
      aria-label={replayActionLabel}
      title={replayActionLabel}
    >
      <FontAwesomeIcon
        icon={isReplaying ? faPause : faPlay}
        className={ANALYZER_ACTION_ICON_CLASS}
        style={ANALYZER_ACTION_ICON_STYLE}
      />
    </button>
  );
}

function StopReplayButton({
  chartActionButtonClasses,
  isReplayExporting,
  isVideoExportActive,
  onStop,
}) {
  const stopLabel = isVideoExportActive ? 'Cancel replay export' : 'Stop replay and restore chart';

  return (
    <button
      type='button'
      onClick={onStop}
      className={chartActionButtonClasses}
      disabled={isReplayExporting && !isVideoExportActive}
      aria-label={stopLabel}
      title={stopLabel}
    >
      <FontAwesomeIcon
        icon={faStop}
        className={ANALYZER_ACTION_ICON_CLASS}
        style={ANALYZER_ACTION_ICON_STYLE}
      />
    </button>
  );
}

function ReplayAndExportActions({
  chartActionButtonClasses,
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isControlsLocked,
  isReplayPaused,
  isReplaying,
  isReplayExporting,
  isVideoExportActive,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onIncludeLegendChange,
  onReplayToggle,
  onStop,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
  showExportButton,
  showReplayButton,
  showStopButton,
}) {
  const shouldShowReplayDivider = showReplayButton || showStopButton;

  return (
    <>
      {showReplayButton ? (
        <ReplayActionButton
          chartActionButtonClasses={chartActionButtonClasses}
          isControlsLocked={isControlsLocked}
          isReplayPaused={isReplayPaused}
          isReplaying={isReplaying}
          onReplayToggle={onReplayToggle}
        />
      ) : null}
      {showStopButton ? (
        <StopReplayButton
          chartActionButtonClasses={chartActionButtonClasses}
          isReplayExporting={isReplayExporting}
          isVideoExportActive={isVideoExportActive}
          onStop={onStop}
        />
      ) : null}
      {shouldShowReplayDivider ? <ChartActionDivider /> : null}
      {showExportButton ? (
        <>
          <ShotMediaExportMenu
            exportMenuRef={exportMenuRef}
            exportMenuState={exportMenuState}
            hasVideoExportSupport={hasVideoExportSupport}
            isControlsLocked={isControlsLocked}
            onCloseExportMenu={onCloseExportMenu}
            onExportAction={onExportAction}
            onExportMenuToggle={onExportMenuToggle}
            onExportTypeChange={onExportTypeChange}
            onExportFormatChange={onExportFormatChange}
            onExportFormatInfoToggle={onExportFormatInfoToggle}
            onIncludeLegendChange={onIncludeLegendChange}
            shouldLockWebmToggle={shouldLockWebmToggle}
            shouldShowWebmToggle={shouldShowWebmToggle}
            buttonClassName={chartActionButtonClasses}
          />
          <ChartActionDivider />
        </>
      ) : null}
    </>
  );
}

export function ShotChartMobileReplayActions({
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isControlsLocked,
  isReplayPaused,
  isReplaying,
  isReplayExporting,
  isVideoExportActive,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onIncludeLegendChange,
  onReplayToggle,
  onStop,
  replayExportStatus,
  replayExportStatusHint,
  replayExportStatusLabel,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
}) {
  const chartActionButtonClasses = getAnalyzerIconButtonClasses({
    className: `${ANALYZER_ACTION_ICON_BUTTON_CLASS} border-0 bg-transparent shadow-none`,
  });

  return (
    <div className='shot-chart-mobile-actions'>
      <div className='shot-chart-mobile-actions__group'>
        <ReplayActionButton
          chartActionButtonClasses={chartActionButtonClasses}
          isControlsLocked={isControlsLocked}
          isReplayPaused={isReplayPaused}
          isReplaying={isReplaying}
          onReplayToggle={onReplayToggle}
        />
        <StopReplayButton
          chartActionButtonClasses={chartActionButtonClasses}
          isReplayExporting={isReplayExporting}
          isVideoExportActive={isVideoExportActive}
          onStop={onStop}
        />
      </div>

      <div className='shot-chart-mobile-actions__group shot-chart-mobile-actions__group--right'>
        <ShotMediaExportMenu
          exportMenuRef={exportMenuRef}
          exportMenuState={exportMenuState}
          hasVideoExportSupport={hasVideoExportSupport}
          isControlsLocked={isControlsLocked}
          onCloseExportMenu={onCloseExportMenu}
          onExportAction={onExportAction}
          onExportMenuToggle={onExportMenuToggle}
          onExportTypeChange={onExportTypeChange}
          onExportFormatChange={onExportFormatChange}
          onExportFormatInfoToggle={onExportFormatInfoToggle}
          onIncludeLegendChange={onIncludeLegendChange}
          shouldLockWebmToggle={shouldLockWebmToggle}
          shouldShowWebmToggle={shouldShowWebmToggle}
          buttonClassName={chartActionButtonClasses}
          menuClassName='absolute right-0 bottom-full z-[70] mb-2'
        />
      </div>

      <div className='shot-chart-mobile-actions__status'>
        <ReplayExportStatus
          replayExportStatus={replayExportStatus}
          replayExportStatusHint={replayExportStatusHint}
          replayExportStatusLabel={replayExportStatusLabel}
        />
      </div>
    </div>
  );
}

function FullDisplayButton({
  chartActionButtonClasses,
  isControlsLocked,
  isFullDisplay,
  onFullDisplayToggle,
}) {
  return (
    <button
      type='button'
      onClick={onFullDisplayToggle}
      className={chartActionButtonClasses}
      disabled={isControlsLocked}
      aria-label={isFullDisplay ? 'Close full display' : 'Open full display'}
      title={isFullDisplay ? 'Close full display' : 'Open full display'}
    >
      <FontAwesomeIcon
        icon={isFullDisplay ? faDownLeftAndUpRightToCenter : faUpRightAndDownLeftFromCenter}
        className={ANALYZER_ACTION_ICON_CLASS}
        style={ANALYZER_ACTION_ICON_STYLE}
      />
    </button>
  );
}

function ChartActionGroup({
  chartActionButtonClasses,
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isCompareMode,
  isControlsLocked,
  isFullDisplay,
  isMobile,
  isReplayPaused,
  isReplaying,
  isReplayExporting,
  isVideoExportActive,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onFullDisplayToggle,
  onIncludeLegendChange,
  onReplayToggle,
  onStop,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
  showExportButton,
  showFullDisplayButton,
  showReplayButton,
  showStopButton,
}) {
  const shouldShowFullDisplayButton = showFullDisplayButton && !isMobile;

  return (
    <div className={ANALYZER_ACTION_GROUP_CLASSES}>
      {isCompareMode ? null : (
        <ReplayAndExportActions
          chartActionButtonClasses={chartActionButtonClasses}
          exportMenuRef={exportMenuRef}
          exportMenuState={exportMenuState}
          hasVideoExportSupport={hasVideoExportSupport}
          isControlsLocked={isControlsLocked}
          isReplayPaused={isReplayPaused}
          isReplaying={isReplaying}
          isReplayExporting={isReplayExporting}
          isVideoExportActive={isVideoExportActive}
          onCloseExportMenu={onCloseExportMenu}
          onExportAction={onExportAction}
          onExportMenuToggle={onExportMenuToggle}
          onExportTypeChange={onExportTypeChange}
          onExportFormatChange={onExportFormatChange}
          onExportFormatInfoToggle={onExportFormatInfoToggle}
          onIncludeLegendChange={onIncludeLegendChange}
          onReplayToggle={onReplayToggle}
          onStop={onStop}
          shouldLockWebmToggle={shouldLockWebmToggle}
          shouldShowWebmToggle={shouldShowWebmToggle}
          showExportButton={showExportButton}
          showReplayButton={showReplayButton}
          showStopButton={showStopButton}
        />
      )}
      {shouldShowFullDisplayButton ? (
        <FullDisplayButton
          chartActionButtonClasses={chartActionButtonClasses}
          isControlsLocked={isControlsLocked}
          isFullDisplay={isFullDisplay}
          onFullDisplayToggle={onFullDisplayToggle}
        />
      ) : null}
    </div>
  );
}

function ReplayExportStatus({
  replayExportStatus,
  replayExportStatusHint,
  replayExportStatusLabel,
}) {
  if (replayExportStatusLabel) {
    return (
      <div className='min-w-[10rem] text-right'>
        <div
          className={`text-xs font-medium ${
            replayExportStatus.error ? 'text-error' : 'text-base-content/65'
          }`}
        >
          {replayExportStatusLabel}
        </div>
        {replayExportStatusHint ? (
          <div className='text-base-content/45 mt-0.5 text-[9px] leading-relaxed'>
            {replayExportStatusHint}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function CompareShotLegend({ compareShotLegendItems, onCompareSwap }) {
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2.5'>
      {compareShotLegendItems.map((item, index) => (
        <Fragment key={item.label}>
          <div className='text-base-content/70 inline-flex min-w-0 items-center gap-1 text-xs font-normal'>
            <span
              className={[
                'analyzer-compare-shot-badge inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums',
                item.shotNumber === 2 ? 'analyzer-compare-shot-badge--striped' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--analyzer-compare-shot-color': item.badgeColor || item.color }}
              aria-label={`Shot ${item.shotNumber || ''}`}
            >
              {item.shotNumber}
            </span>
            <span className='truncate'>{item.label}</span>
          </div>
          {index === 0 && compareShotLegendItems.length > 1 && onCompareSwap ? (
            <button
              type='button'
              onClick={onCompareSwap}
              className={getAnalyzerIconButtonClasses({
                className: 'h-7 min-h-0 w-7 rounded-lg p-0 text-sm',
              })}
              title='Swap shot 1 and shot 2'
              aria-label='Swap shot 1 and shot 2'
            >
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className='text-sm' />
            </button>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function CompareAnnotationToggle({
  compareAnnotationsEnabled,
  onCompareAnnotationsToggle,
  showCompareAnnotationToggle,
}) {
  if (showCompareAnnotationToggle && onCompareAnnotationsToggle) {
    return (
      <button
        type='button'
        onClick={onCompareAnnotationsToggle}
        className={getAnalyzerTextButtonClasses({
          className: `h-6 min-h-0 px-2 text-xs font-medium ${
            compareAnnotationsEnabled
              ? 'bg-base-content/8 text-base-content/80'
              : 'text-base-content/55'
          }`,
        })}
        aria-pressed={compareAnnotationsEnabled}
        title={compareAnnotationsEnabled ? 'Hide compare annotations' : 'Show compare annotations'}
      >
        Annotations
      </button>
    );
  }

  return null;
}

export function CompareSelect({ onChange, options, title, value, widthClass }) {
  if (onChange && options.length > 0) {
    return (
      <div className={`relative flex ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} items-center`}>
        <select
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
          className={getAnalyzerSurfaceTriggerClasses({
            className: `${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} ${widthClass} appearance-none rounded-md border-0 bg-transparent px-2.5 pr-6 text-xs font-medium shadow-none outline-none`,
          })}
          title={title}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className='text-base-content/60 pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs'>
          <FontAwesomeIcon icon={faChevronDown} />
        </span>
      </div>
    );
  }

  return null;
}

export function CompareTargetSelect({
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
}) {
  return (
    <CompareSelect
      onChange={onCompareTargetDisplayModeChange}
      options={[
        { value: COMPARE_TARGET_DISPLAY_MODES.NONE, label: 'No Targets' },
        { value: COMPARE_TARGET_DISPLAY_MODES.PER_SHOT, label: 'Per Shot' },
        { value: COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY, label: 'Main Shot' },
      ]}
      title='Target display mode'
      value={compareTargetDisplayMode}
      widthClass='w-[7rem] max-w-[7rem]'
    />
  );
}

function CompareControlsRow({
  compareAlignmentMode,
  compareAlignmentOptions,
  compareAnnotationsEnabled,
  compareShotLegendItems,
  compareTargetDisplayMode,
  onCompareAlignmentModeChange,
  onCompareAnnotationsToggle,
  onCompareSwap,
  onCompareTargetDisplayModeChange,
  shouldShowCompareControls,
  showCompareAnnotationToggle,
}) {
  if (shouldShowCompareControls) {
    return (
      <div className='mt-2 mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1'>
        <CompareShotLegend
          compareShotLegendItems={compareShotLegendItems}
          onCompareSwap={onCompareSwap}
        />

        <div className='flex items-center gap-2'>
          <CompareAnnotationToggle
            compareAnnotationsEnabled={compareAnnotationsEnabled}
            onCompareAnnotationsToggle={onCompareAnnotationsToggle}
            showCompareAnnotationToggle={showCompareAnnotationToggle}
          />

          <CompareSelect
            onChange={onCompareAlignmentModeChange}
            options={compareAlignmentOptions}
            title='Compare alignment'
            value={compareAlignmentMode}
            widthClass='w-[9rem] max-w-[9rem]'
          />

          <CompareTargetSelect
            compareTargetDisplayMode={compareTargetDisplayMode}
            onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
          />
        </div>
      </div>
    );
  }

  return null;
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
