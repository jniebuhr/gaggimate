import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import { faDownLeftAndUpRightToCenter } from '@fortawesome/free-solid-svg-icons/faDownLeftAndUpRightToCenter';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faMaximize } from '@fortawesome/free-solid-svg-icons/faMaximize';
import { faMinimize } from '@fortawesome/free-solid-svg-icons/faMinimize';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faStop } from '@fortawesome/free-solid-svg-icons/faStop';
import { faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons/faUpRightAndDownLeftFromCenter';
import {
  LEGEND_BLOCK_LABELS,
  LEGEND_DASHED_LABELS,
  LEGEND_ORDER,
  LEGEND_THIN_LINE_LABELS,
  MAIN_CHART_HEIGHT_BIG,
  MAIN_CHART_HEIGHT_SMALL,
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
} from './constants';
import {
  ANALYZER_COMPACT_ICON_BUTTON_CLASS,
  ANALYZER_COMPACT_SEGMENTED_GROUP_CLASSES,
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from '../analyzerControlStyles';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from './labelVisuals';

function renderLegendMarker({ label, labelIcon, swatchColor, swatchLineWidth }) {
  if (LEGEND_BLOCK_LABELS.has(label)) {
    return <span className='h-2.5 w-3 rounded-[2px]' style={{ backgroundColor: swatchColor }} />;
  }

  if (labelIcon) {
    return (
      <FontAwesomeIcon
        icon={labelIcon}
        className='text-[10px]'
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
  mainChartHeight,
  onChartHeightToggle,
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
  visibility,
}) {
  const chartActionButtonClasses = getAnalyzerIconButtonClasses({
    className: `btn btn-ghost btn-xs ${ANALYZER_COMPACT_ICON_BUTTON_CLASS} rounded-none border-0 bg-transparent p-0 shadow-none`,
  });
  const replayActionLabel = getReplayActionLabel({ isReplaying, isReplayPaused });

  return (
    <>
      {/* Keep the control bar extracted so ShotChart.jsx can focus on chart lifecycle and replay logic. */}
      <div className='mb-2 flex flex-wrap items-center gap-2 px-1'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1'>
          {LEGEND_ORDER.map(label => {
            if (label === 'Weight' && !hasWeightData) return null;
            if (label === 'Weight Flow' && !hasWeightFlowData) return null;
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
                className={`inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  isVisible
                    ? 'text-base-content hover:bg-base-content/5 opacity-90'
                    : 'text-base-content/60 hover:bg-base-content/5 hover:text-primary opacity-45 hover:opacity-75'
                }`}
              >
                {renderLegendMarker({ label, labelIcon, swatchColor, swatchLineWidth })}
                <span>{displayLabel}</span>
              </button>
            );
          })}
        </div>

        <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
          <div className={ANALYZER_COMPACT_SEGMENTED_GROUP_CLASSES}>
            <button
              type='button'
              onClick={onReplayToggle}
              className={chartActionButtonClasses}
              disabled={isControlsLocked}
              aria-label={replayActionLabel}
              title={replayActionLabel}
            >
              <FontAwesomeIcon icon={isReplaying ? faPause : faPlay} className='text-[10px]' />
            </button>
            <button
              type='button'
              onClick={onStop}
              className={chartActionButtonClasses}
              disabled={isReplayExporting && !isVideoExportActive}
              aria-label={
                isVideoExportActive ? 'Cancel replay export' : 'Stop replay and restore chart'
              }
              title={isVideoExportActive ? 'Cancel replay export' : 'Stop replay and restore chart'}
            >
              <FontAwesomeIcon icon={faStop} className='text-[10px]' />
            </button>
            <div ref={exportMenuRef} className='relative flex'>
              <button
                type='button'
                onClick={onExportMenuToggle}
                className={`${chartActionButtonClasses} ${exportMenuState.open ? 'text-base-content/90' : ''}`}
                disabled={isControlsLocked}
                aria-label='Open export menu'
                aria-expanded={exportMenuState.open}
                title='Open export menu'
              >
                <FontAwesomeIcon icon={faFileExport} className='text-[10px]' />
              </button>
              {exportMenuState.open ? (
                <div className='bg-base-100/95 border-base-content/10 absolute top-full right-0 z-[70] mt-2 w-[min(92vw,15rem)] rounded-xl border p-3 text-[12px] shadow-xl backdrop-blur-md'>
                  <div className='mb-2 text-[11px] font-semibold tracking-wide uppercase opacity-60'>
                    Export Shot
                  </div>
                  <div className='space-y-1'>
                    {[
                      {
                        value: 'video',
                        label: hasVideoExportSupport ? 'Video' : 'Video (unsupported)',
                        disabled: !hasVideoExportSupport,
                      },
                      { value: 'image', label: 'Image (.png)' },
                      { value: 'json', label: 'Shot JSON (.json)' },
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
                  {exportMenuState.exportType !== 'json' ? (
                    <label
                      className={getAnalyzerSurfaceTriggerClasses({
                        className: 'mt-2 flex cursor-pointer items-center gap-2 px-2 py-1.5',
                      })}
                    >
                      <input
                        type='checkbox'
                        className='checkbox checkbox-xs'
                        checked={exportMenuState.includeLegend}
                        onChange={event => onIncludeLegendChange(event.currentTarget.checked)}
                      />
                      <span className='text-sm'>Include legend</span>
                    </label>
                  ) : null}
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
                            className='checkbox checkbox-xs'
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
                            className: 'btn btn-ghost btn-xs h-6 min-h-0 w-6 p-0',
                          })}
                          aria-label='Explain WebM export'
                          aria-expanded={exportMenuState.showFormatInfo}
                          title='Explain WebM export'
                        >
                          <FontAwesomeIcon icon={faCircleInfo} className='text-[11px] opacity-70' />
                        </button>
                      </div>
                      {exportMenuState.showFormatInfo ? (
                        <p className='text-base-content/70 mt-2 pr-1 text-[11px] leading-relaxed'>
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
                        className: 'btn btn-ghost btn-xs h-7 min-h-0 px-2.5',
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
            <button
              type='button'
              onClick={onChartHeightToggle}
              className={chartActionButtonClasses}
              disabled={isControlsLocked || isFullDisplay}
              aria-label={
                mainChartHeight === MAIN_CHART_HEIGHT_BIG ? 'Minimize chart' : 'Maximize chart'
              }
              title={
                mainChartHeight === MAIN_CHART_HEIGHT_BIG ? 'Minimize chart' : 'Maximize chart'
              }
            >
              <FontAwesomeIcon
                icon={mainChartHeight === MAIN_CHART_HEIGHT_BIG ? faMinimize : faMaximize}
                className='text-[10px]'
              />
            </button>
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
                className='text-[10px]'
              />
            </button>
          </div>
          {replayExportStatusLabel ? (
            <div className='min-w-[10rem] text-right'>
              <div
                className={`text-[10px] font-semibold ${
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
          ) : null}
        </div>
      </div>

      {shouldShowReplayFocusHint ? (
        <div className='mb-2 px-1'>
          <div className='border-base-content/10 bg-base-100/70 inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold text-[var(--analyzer-warning-orange)] shadow-sm'>
            Keep this window focused while the replay is being recorded.
          </div>
        </div>
      ) : null}
    </>
  );
}

export function getNextChartHeight(currentHeight) {
  return currentHeight === MAIN_CHART_HEIGHT_SMALL
    ? MAIN_CHART_HEIGHT_BIG
    : MAIN_CHART_HEIGHT_SMALL;
}
