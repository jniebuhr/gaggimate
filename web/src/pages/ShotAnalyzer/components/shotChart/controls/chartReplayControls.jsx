import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons/faArrowUpRightFromSquare';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import { faDownLeftAndUpRightToCenter } from '@fortawesome/free-solid-svg-icons/faDownLeftAndUpRightToCenter';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faStop } from '@fortawesome/free-solid-svg-icons/faStop';
import { faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons/faUpRightAndDownLeftFromCenter';
import {
  ANALYZER_ACTION_GROUP_CLASSES,
  ANALYZER_ACTION_ICON_BUTTON_CLASS,
  ANALYZER_ACTION_ICON_CLASS,
  ANALYZER_ACTION_ICON_STYLE,
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from '../../analyzerControlStyles';

function getReplayActionLabel({ isReplaying, isReplayPaused }) {
  if (isReplaying) return 'Pause replay';
  if (isReplayPaused) return 'Resume replay';
  return 'Replay chart';
}

function ChartActionDivider() {
  return <span className='bg-base-content/15 mx-1 h-4 w-px shrink-0' aria-hidden='true' />;
}

function ShotMediaExportMenu({
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isControlsLocked,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  profileExportAvailable,
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
  const fileExportTypes = ['shot', 'profile'].filter(type =>
    exportMenuState.exportType?.includes(type),
  );

  const handleFileExportTypeToggle = fileExportType => {
    const nextExportType = fileExportTypes.includes(fileExportType)
      ? fileExportTypes.filter(type => type !== fileExportType)
      : [...fileExportTypes, fileExportType];
    onExportTypeChange(nextExportType.join('+') || null);
  };

  return (
    <div ref={exportMenuRef} className='relative flex'>
      <button
        type='button'
        onClick={onExportMenuToggle}
        className={`${buttonClassName} ${exportMenuState.open ? 'text-base-content/90' : ''}`}
        disabled={isControlsLocked}
        aria-label='Share'
        aria-expanded={exportMenuState.open}
        title='Share'
      >
        <FontAwesomeIcon
          icon={faArrowUpRightFromSquare}
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
          <div className='mt-3 mb-2 text-xs font-medium opacity-60'>Export File</div>
          {[
            { value: 'shot', label: 'Shot', disabled: false },
            { value: 'profile', label: 'Profile', disabled: !profileExportAvailable },
          ].map(option => (
            <label
              key={option.value}
              className={getAnalyzerSurfaceTriggerClasses({
                className: `flex w-full items-center gap-2 px-2 py-1.5 ${
                  option.disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                }`,
              })}
            >
              <input
                type='checkbox'
                className='checkbox checkbox-xs'
                checked={fileExportTypes.includes(option.value)}
                disabled={option.disabled}
                onChange={() => handleFileExportTypeToggle(option.value)}
              />
              <span className='text-sm'>{option.label}</span>
            </label>
          ))}
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
  profileExportAvailable,
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
            profileExportAvailable={profileExportAvailable}
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
  profileExportAvailable,
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
          profileExportAvailable={profileExportAvailable}
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

export function ChartActionGroup({
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
  profileExportAvailable,
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
          profileExportAvailable={profileExportAvailable}
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

export function ReplayExportStatus({
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
