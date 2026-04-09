/**
 * StatusBar.jsx
 * * Merges seamlessly with the dropdown when expanded.
 */

import { useRef, useState } from 'preact/hooks';
import { cleanName, analyzerUiColors } from '../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons/faRotateRight';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';
import compareIconUrl from '../assets/compare.svg';

function hasFileDrag(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  if (Array.isArray(types)) return types.includes('Files');
  if (typeof types.contains === 'function') return types.contains('Files');
  return false;
}

function getProfileBadgeClasses({ isMismatch, currentProfile, badgeBaseClass, loadedShadowClass }) {
  if (isMismatch) return `${badgeBaseClass} ${loadedShadowClass} text-white`;
  if (currentProfile) {
    return `${badgeBaseClass} ${loadedShadowClass} bg-primary border-primary text-primary-content`;
  }
  return `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;
}

function getGhostedBadgeClasses(baseClasses, isActive) {
  if (isActive) {
    // Secondary compare slots stay visually tied to the active theme while
    // remaining lighter than the primary bar.
    return `${baseClasses} bg-primary/24 border-transparent text-primary hover:bg-primary/30 shadow-none`;
  }
  return `${baseClasses} bg-base-200/60 border-transparent text-base-content/90 hover:bg-base-200/72 shadow-none`;
}

function getProfileBadgeTitle(isMismatch) {
  if (isMismatch) {
    return 'Profile mismatch detected. Use the import icon or drop files here to import.';
  }
  return 'Click to open the library. Use the import icon or drop files here to import.';
}

function CompareIcon({ className = 'inline-block h-4.5 w-4.5' }) {
  return (
    <span
      aria-hidden='true'
      className={className}
      style={{
        backgroundColor: 'currentColor',
        maskImage: `url(${compareIconUrl})`,
        WebkitMaskImage: `url(${compareIconUrl})`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}

export function StatusBar({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  onUnloadShot,
  onUnloadProfile,
  onShowStats,
  onCompareModeToggle,
  onRetryProfileSearch,
  onTogglePanel,
  onShotPanelToggle,
  onProfilePanelToggle,
  onImportShot,
  onImportProfile,
  onImport,
  isMismatch,
  statsHref = '/statistics',
  compareAvailable = false,
  compareMode = false,
  isImporting = false, // Show spinner on import button
  isSearchingProfile = false, // Show spinner on profile badge
  compact = false,
  showCompareButton = true,
  compareBadgeNumber = null,
  ghosted = false,
}) {
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const importTargetRef = useRef('shot');
  const [isDragActive, setIsDragActive] = useState(false);

  const clearDragState = () => {
    dragDepthRef.current = 0;
    setIsDragActive(false);
  };

  const resolveImportHandler = target =>
    (target === 'profile' ? onImportProfile : onImportShot) || onImport;

  const getImportTargetFromEvent = event => {
    const targetElement = event?.target;
    if (!targetElement || typeof targetElement.closest !== 'function') return 'shot';
    // Compare mode reuses the same drop zone for shots and profiles, so the
    // nearest target marker decides which import handler receives the files.
    return targetElement.closest('[data-import-target="profile"]') ? 'profile' : 'shot';
  };

  const openFilePicker = (event, target = 'shot') => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (isImporting) return;
    importTargetRef.current = target;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = e => {
    const files = e.target.files;
    const importHandler = resolveImportHandler(importTargetRef.current);
    if (files && files.length > 0 && importHandler) {
      clearDragState();
      importHandler(files);
      e.target.value = '';
    }
  };

  const handleDragEnter = e => {
    if (isImporting || !hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = e => {
    if (isImporting || !hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = e => {
    if (isImporting || !isDragActive) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };

  const handleDrop = e => {
    if (isImporting || !hasFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    clearDragState();
    const files = e.dataTransfer.files;
    const importTarget = getImportTargetFromEvent(e);
    const importHandler = resolveImportHandler(importTarget);
    if (files && files.length > 0 && importHandler) {
      importHandler(files);
    }
  };

  const handleShotPanelToggle = onShotPanelToggle || onTogglePanel;
  const handleProfilePanelToggle = onProfilePanelToggle || onTogglePanel;

  const badgeBaseClass = compact
    ? 'flex items-center justify-between flex-1 px-2 h-full rounded-md border cursor-pointer transition-all min-w-0'
    : 'flex items-center justify-between flex-1 px-2 sm:px-3 h-full rounded-lg border-2 cursor-pointer transition-all min-w-0';
  const shotBadgeClasses = ghosted
    ? getGhostedBadgeClasses(badgeBaseClass, Boolean(currentShot))
    : currentShot
      ? `${badgeBaseClass} bg-primary border-primary text-primary-content`
      : `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;

  const mismatchProfileBadgeStyle = isMismatch
    ? {
        backgroundColor: ghosted
          ? `color-mix(in srgb, ${analyzerUiColors.warningOrange} 34%, transparent)`
          : analyzerUiColors.warningOrange,
        borderColor: ghosted
          ? `color-mix(in srgb, ${analyzerUiColors.warningOrangeStrong} 46%, transparent)`
          : analyzerUiColors.warningOrangeStrong,
        boxShadow: `0 1px 2px 0 ${analyzerUiColors.warningOrangeShadow}`,
      }
    : undefined;

  const profileBadgeClasses =
    ghosted && !isMismatch
      ? getGhostedBadgeClasses(badgeBaseClass, Boolean(currentProfile))
      : getProfileBadgeClasses({
          isMismatch,
          currentProfile,
          badgeBaseClass,
          loadedShadowClass: '',
        });

  const neutralImportButtonClasses = getAnalyzerIconButtonClasses({
    className: `${compact ? 'h-5 w-5' : 'h-6 w-6'} flex-shrink-0 rounded-full ${
      ghosted ? 'opacity-85 hover:opacity-100' : 'opacity-75 hover:opacity-100'
    }`,
  });

  const activeBadgeIconButtonClasses = getAnalyzerIconButtonClasses({
    className:
      `${compact ? 'h-5 w-5' : 'h-6 w-6'} flex-shrink-0 rounded-full text-current ${
        ghosted
          ? 'opacity-90 hover:bg-primary/12 hover:text-current hover:opacity-100'
          : 'opacity-75 hover:bg-black/10 hover:text-current hover:opacity-100'
      }`,
  });
  const compareBadgeIconButtonClasses = compareMode
    ? `${activeBadgeIconButtonClasses} bg-black/10 opacity-100 ring-1 ring-current/15`
    : currentShot
      ? activeBadgeIconButtonClasses
      : neutralImportButtonClasses;
  const profileStatsButtonClasses =
    currentProfile || isMismatch ? activeBadgeIconButtonClasses : neutralImportButtonClasses;
  const statisticsIcon = compareMode ? faChartArea : faChartSimple;
  // Empty compare slots keep a neutral badge so slot numbers communicate state
  // without suggesting that a shot is already loaded.
  const compareBadgeClasses = currentShot
    ? ghosted
      ? 'bg-primary/70 text-primary-content ring-base-100'
      : 'bg-primary text-primary-content ring-base-100'
    : 'bg-base-100 text-base-content/55 ring-base-200';

  const renderImportButton = (label, useCurrentTone = false, target = 'shot') => (
    <button
      type='button'
      onClick={event => openFilePicker(event, target)}
      className={useCurrentTone ? activeBadgeIconButtonClasses : neutralImportButtonClasses}
      title={`Import ${label}`}
      aria-label={`Import ${label}`}
      disabled={isImporting}
    >
      <FontAwesomeIcon
        icon={isImporting ? faCircleNotch : faFileImport}
        spin={isImporting}
        className={compact ? 'text-xs' : 'text-sm'}
      />
    </button>
  );

  const renderProfileTrailingControl = () => {
    const statsTitle = currentProfile
      ? 'Open profile statistics'
      : 'Load a profile to open statistics';
    const retryTitle = 'Retry automatic profile search';

    if (currentProfile) {
      return (
        <div className='flex items-center gap-1'>
          <a
            href={statsHref || '/statistics'}
            onClick={event => {
              event.stopPropagation();
              onShowStats?.();
            }}
            className={profileStatsButtonClasses}
            title={statsTitle}
            aria-label={statsTitle}
          >
            <FontAwesomeIcon icon={statisticsIcon} className='text-xs' />
          </a>

          {isMismatch && onRetryProfileSearch ? (
            <button
              type='button'
              onClick={event => {
                event.stopPropagation();
                onRetryProfileSearch();
              }}
              className={activeBadgeIconButtonClasses}
              title={retryTitle}
              aria-label={retryTitle}
              disabled={isSearchingProfile}
            >
              <FontAwesomeIcon
                icon={isSearchingProfile ? faCircleNotch : faRotateRight}
                spin={isSearchingProfile}
                className='text-xs'
              />
            </button>
          ) : null}

          {isSearchingProfile && !isMismatch ? (
            <FontAwesomeIcon icon={faCircleNotch} spin className='text-xs opacity-70' />
          ) : (
            <button
              type='button'
              onClick={e => {
                e.stopPropagation();
                onUnloadProfile();
              }}
              className={activeBadgeIconButtonClasses}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className='flex items-center gap-1'>
        <button
          type='button'
          disabled={true}
          className={profileStatsButtonClasses}
          title={statsTitle}
          aria-label={statsTitle}
        >
          <FontAwesomeIcon icon={statisticsIcon} className='text-xs' />
        </button>

        {isSearchingProfile ? (
          <FontAwesomeIcon icon={faCircleNotch} spin className='text-xs opacity-70' />
        ) : null}
      </div>
    );
  };

  const renderShotTrailingControl = () => {
    const compareTitle = compareMode ? 'Disable compare mode' : 'Enable compare mode';

    return (
      <div className='flex items-center gap-1'>
        {showCompareButton ? (
          <button
            type='button'
            onClick={event => {
              event.stopPropagation();
              onCompareModeToggle?.();
            }}
            disabled={!compareAvailable}
            className={compareBadgeIconButtonClasses}
            title={compareAvailable ? compareTitle : 'No shots available to compare'}
            aria-label={compareAvailable ? compareTitle : 'No shots available to compare'}
          >
            <CompareIcon className={compact ? 'inline-block h-4 w-4' : 'inline-block h-4.5 w-4.5'} />
          </button>
        ) : null}

        {currentShot ? (
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onUnloadShot();
            }}
            className={activeBadgeIconButtonClasses}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className='relative w-full overflow-visible'
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {compareBadgeNumber ? (
        <span
          className={`pointer-events-none absolute top-0 left-1 z-10 inline-flex h-4 min-w-4 -translate-x-1/3 -translate-y-1/4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold shadow-md ring-2 ${compareBadgeClasses}`}
        >
          {compareBadgeNumber}
        </span>
      ) : null}
      <div className={`relative ${compact ? 'px-1.5 py-0.5 sm:px-2' : 'px-1.5 py-1.5 sm:px-2'}`}>
        <div
          className={`grid ${compact ? 'h-8 rounded-lg' : 'h-10 min-h-10 rounded-xl'} w-full items-center gap-1 transition-all sm:gap-1.5 ${
            isDragActive ? 'bg-primary/8 ring-primary/30 shadow-lg ring-2' : ''
          }`}
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          }}
        >
          {/* --- CENTER: SHOT BADGE --- */}
          <div
            data-import-target='shot'
            className={shotBadgeClasses}
            title='Click to open the library. Use the import icon or drop files here to import.'
          >
            <div className='flex flex-shrink-0 items-center gap-2'>
              {renderImportButton('files into the Shot Analyzer', Boolean(currentShot), 'shot')}
            </div>
            <button
              type='button'
              onClick={handleShotPanelToggle}
              className={`mx-1.5 flex min-w-0 flex-1 self-stretch items-center justify-center overflow-hidden text-center ${compact ? 'text-xs font-semibold' : 'text-sm font-bold'}`}
              title='Open library'
            >
              <span className='inline-flex max-w-full items-center justify-center gap-1'>
                <span className='truncate'>
                  {currentShot?.source === 'gaggimate'
                    ? `#${currentShot.id}`
                    : cleanName(currentShotName)}
                </span>
                {!currentShot ? (
                  <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-[11px] opacity-40' />
                ) : null}
              </span>
            </button>
            {renderShotTrailingControl()}
          </div>

          {/* --- CENTER: PROFILE BADGE --- */}
          <div
            data-import-target='profile'
            className={profileBadgeClasses}
            style={mismatchProfileBadgeStyle}
            title={getProfileBadgeTitle(isMismatch)}
          >
            <div className='flex flex-shrink-0 items-center gap-2'>
              {renderImportButton(
                'files into the Shot Analyzer',
                Boolean(currentProfile) || isMismatch,
                'profile',
              )}
            </div>

            <button
              type='button'
              onClick={handleProfilePanelToggle}
              className={`mx-1.5 flex min-w-0 flex-1 self-stretch items-center justify-center overflow-hidden text-center ${compact ? 'text-xs font-semibold' : 'text-sm font-bold'}`}
              title={getProfileBadgeTitle(isMismatch)}
            >
              <span className='inline-flex max-w-full items-center justify-center gap-1'>
                {isSearchingProfile && !currentProfile ? (
                  <span className='truncate italic opacity-50'>Searching Profile...</span>
                ) : (
                  <>
                    {isMismatch ? (
                      <FontAwesomeIcon icon={faTriangleExclamation} className='mr-1 shrink-0' />
                    ) : null}
                    <span className='truncate'>{cleanName(currentProfileName)}</span>
                  </>
                )}
                {!currentProfile && !isSearchingProfile ? (
                  <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-[11px] opacity-40' />
                ) : null}
              </span>
            </button>

            {renderProfileTrailingControl()}
          </div>
        </div>
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
    </div>
  );
}
