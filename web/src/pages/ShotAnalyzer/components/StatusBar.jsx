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

function getShotBadgeClasses({ ghosted, badgeBaseClass, currentShot }) {
  if (ghosted) {
    return getGhostedBadgeClasses(badgeBaseClass, Boolean(currentShot));
  }
  if (currentShot) {
    return `${badgeBaseClass} bg-primary border-primary text-primary-content`;
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

function getCompareBadgeIconButtonClasses({
  compareMode,
  currentShot,
  activeBadgeIconButtonClasses,
  neutralImportButtonClasses,
}) {
  if (compareMode) {
    return `${activeBadgeIconButtonClasses} bg-black/10 opacity-100 ring-1 ring-current/15`;
  }
  return currentShot ? activeBadgeIconButtonClasses : neutralImportButtonClasses;
}

function getCompareSlotBadgeClasses({ currentShot, ghosted }) {
  if (!currentShot) return 'bg-base-100 text-base-content/55 ring-base-200';
  return ghosted
    ? 'bg-primary/70 text-primary-content ring-base-100'
    : 'bg-primary text-primary-content ring-base-100';
}

function getShotBadgeLabel(currentShot, currentShotName) {
  if (currentShot?.source === 'gaggimate') {
    return `#${currentShot.id}`;
  }
  return cleanName(currentShotName);
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

function useStatusBarImportState({ isImporting, onImportShot, onImportProfile, onImport }) {
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

  const handleFileSelect = event => {
    const files = event.target.files;
    const importHandler = resolveImportHandler(importTargetRef.current);
    if (files && files.length > 0 && importHandler) {
      clearDragState();
      importHandler(files);
      event.target.value = '';
    }
  };

  const handleDragEnter = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = event => {
    if (isImporting || !isDragActive) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };

  const handleDrop = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragState();
    const files = event.dataTransfer.files;
    const importTarget = getImportTargetFromEvent(event);
    const importHandler = resolveImportHandler(importTarget);
    if (files && files.length > 0 && importHandler) {
      importHandler(files);
    }
  };

  return {
    fileInputRef,
    isDragActive,
    handleFileSelect,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openFilePicker,
  };
}

function getMismatchProfileBadgeStyle({ isMismatch, ghosted }) {
  if (!isMismatch) return undefined;

  return {
    backgroundColor: ghosted
      ? `color-mix(in srgb, ${analyzerUiColors.warningOrange} 34%, transparent)`
      : analyzerUiColors.warningOrange,
    borderColor: ghosted
      ? `color-mix(in srgb, ${analyzerUiColors.warningOrangeStrong} 46%, transparent)`
      : analyzerUiColors.warningOrangeStrong,
    boxShadow: `0 1px 2px 0 ${analyzerUiColors.warningOrangeShadow}`,
  };
}

function getStatusBarIconButtonClassSet({ compact, ghosted }) {
  return {
    neutralImportButtonClasses: getAnalyzerIconButtonClasses({
      className: `${compact ? 'h-5 w-5' : 'h-6 w-6'} flex-shrink-0 rounded-full ${
        ghosted ? 'opacity-85 hover:opacity-100' : 'opacity-75 hover:opacity-100'
      }`,
    }),
    activeBadgeIconButtonClasses: getAnalyzerIconButtonClasses({
      className: `${compact ? 'h-5 w-5' : 'h-6 w-6'} flex-shrink-0 rounded-full text-current ${
        ghosted
          ? 'opacity-90 hover:bg-primary/12 hover:text-current hover:opacity-100'
          : 'opacity-75 hover:bg-black/10 hover:text-current hover:opacity-100'
      }`,
    }),
  };
}

function getStatusBarViewModel({
  compact,
  ghosted,
  currentShot,
  currentProfile,
  isMismatch,
  compareMode,
  isSearchingProfile,
}) {
  const badgeBaseClass = compact
    ? 'flex items-center justify-between flex-1 px-2 h-full rounded-md border cursor-pointer transition-all min-w-0'
    : 'flex items-center justify-between flex-1 px-2 sm:px-3 h-full rounded-lg border-2 cursor-pointer transition-all min-w-0';
  const shotBadgeClasses = getShotBadgeClasses({
    ghosted,
    badgeBaseClass,
    currentShot,
  });

  const mismatchProfileBadgeStyle = getMismatchProfileBadgeStyle({
    isMismatch,
    ghosted,
  });

  const profileBadgeClasses =
    ghosted && !isMismatch
      ? getGhostedBadgeClasses(badgeBaseClass, Boolean(currentProfile))
      : getProfileBadgeClasses({
          isMismatch,
          currentProfile,
          badgeBaseClass,
          loadedShadowClass: '',
        });

  const { neutralImportButtonClasses, activeBadgeIconButtonClasses } =
    getStatusBarIconButtonClassSet({
      compact,
      ghosted,
    });

  return {
    shotBadgeClasses,
    mismatchProfileBadgeStyle,
    profileBadgeClasses,
    neutralImportButtonClasses,
    activeBadgeIconButtonClasses,
    compareBadgeIconButtonClasses: getCompareBadgeIconButtonClasses({
      compareMode,
      currentShot,
      activeBadgeIconButtonClasses,
      neutralImportButtonClasses,
    }),
    profileStatsButtonClasses:
      currentProfile || isMismatch ? activeBadgeIconButtonClasses : neutralImportButtonClasses,
    statisticsIcon: compareMode ? faChartArea : faChartSimple,
    compareBadgeClasses: getCompareSlotBadgeClasses({ currentShot, ghosted }),
    showShotChevron: !currentShot,
    showProfileChevron: !currentProfile && !isSearchingProfile,
  };
}

function StatusBarImportButton({
  label,
  useCurrentTone = false,
  target = 'shot',
  openFilePicker,
  activeBadgeIconButtonClasses,
  neutralImportButtonClasses,
  isImporting,
  compact,
}) {
  return (
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
}

function ProfileTrailingControl({
  currentProfile,
  currentProfileName,
  isMismatch,
  isSearchingProfile,
  canRetryProfileSearch,
  onRetryProfileSearch,
  onShowStats,
  onUnloadProfile,
  statsHref,
  profileStatsButtonClasses,
  activeBadgeIconButtonClasses,
  statisticsIcon,
}) {
  const statsTitle = currentProfile
    ? 'Open profile statistics'
    : 'Load a profile to open statistics';
  const retryTitle = 'Retry automatic profile search';
  const hasDismissibleProfileState =
    isSearchingProfile || cleanName(currentProfileName || '').toLowerCase() !== 'no profile loaded';

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

        {(isMismatch || canRetryProfileSearch) && onRetryProfileSearch ? (
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
            <FontAwesomeIcon icon={faRotateRight} className='text-xs' />
          </button>
        ) : null}

        <button
          type='button'
          onClick={event => {
            event.stopPropagation();
            onUnloadProfile();
          }}
          className={activeBadgeIconButtonClasses}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
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

      {canRetryProfileSearch && onRetryProfileSearch ? (
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
          <FontAwesomeIcon icon={faRotateRight} className='text-xs' />
        </button>
      ) : null}

      {hasDismissibleProfileState ? (
        <button
          type='button'
          onClick={event => {
            event.stopPropagation();
            onUnloadProfile();
          }}
          className={activeBadgeIconButtonClasses}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      ) : null}
    </div>
  );
}

function ShotTrailingControl({
  showCompareButton,
  compareMode,
  compareAvailable,
  currentShot,
  compact,
  compareBadgeIconButtonClasses,
  activeBadgeIconButtonClasses,
  onCompareModeToggle,
  onUnloadShot,
}) {
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
          onClick={event => {
            event.stopPropagation();
            onUnloadShot();
          }}
          className={activeBadgeIconButtonClasses}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      ) : null}
    </div>
  );
}

function ShotBadge({
  currentShot,
  currentShotName,
  isShotPending,
  compact,
  shotBadgeClasses,
  showShotChevron,
  handleShotPanelToggle,
  openFilePicker,
  activeBadgeIconButtonClasses,
  neutralImportButtonClasses,
  isImporting,
  showCompareButton,
  compareMode,
  compareAvailable,
  compareBadgeIconButtonClasses,
  onCompareModeToggle,
  onUnloadShot,
}) {
  return (
    <div
      data-import-target='shot'
      className={shotBadgeClasses}
      title='Click to open the library. Use the import icon or drop files here to import.'
    >
      <div className='flex flex-shrink-0 items-center gap-2'>
        <StatusBarImportButton
          label='files into the Shot Analyzer'
          useCurrentTone={Boolean(currentShot)}
          target='shot'
          openFilePicker={openFilePicker}
          activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
          neutralImportButtonClasses={neutralImportButtonClasses}
          isImporting={isImporting}
          compact={compact}
        />
      </div>
      <button
        type='button'
        onClick={handleShotPanelToggle}
        className={`mx-1.5 flex min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden text-center ${compact ? 'text-xs font-semibold' : 'text-sm font-bold'}`}
        title='Open library'
      >
        <span className='inline-flex max-w-full items-center justify-center gap-1'>
          <span className='truncate'>{getShotBadgeLabel(currentShot, currentShotName)}</span>
          {isShotPending ? (
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className='shrink-0 text-[11px] opacity-60'
            />
          ) : null}
          {showShotChevron ? (
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-[11px] opacity-40' />
          ) : null}
        </span>
      </button>
      <ShotTrailingControl
        showCompareButton={showCompareButton}
        compareMode={compareMode}
        compareAvailable={compareAvailable}
        currentShot={currentShot}
        compact={compact}
        compareBadgeIconButtonClasses={compareBadgeIconButtonClasses}
        activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
        onCompareModeToggle={onCompareModeToggle}
        onUnloadShot={onUnloadShot}
      />
    </div>
  );
}

function ProfileBadge({
  currentProfile,
  currentProfileName,
  compact,
  profileBadgeClasses,
  mismatchProfileBadgeStyle,
  isMismatch,
  showProfileChevron,
  handleProfilePanelToggle,
  openFilePicker,
  activeBadgeIconButtonClasses,
  neutralImportButtonClasses,
  isImporting,
  isSearchingProfile,
  canRetryProfileSearch,
  onRetryProfileSearch,
  onShowStats,
  onUnloadProfile,
  statsHref,
  profileStatsButtonClasses,
  statisticsIcon,
}) {
  return (
    <div
      data-import-target='profile'
      className={profileBadgeClasses}
      style={mismatchProfileBadgeStyle}
      title={getProfileBadgeTitle(isMismatch)}
    >
      <div className='flex flex-shrink-0 items-center gap-2'>
        <StatusBarImportButton
          label='files into the Shot Analyzer'
          useCurrentTone={Boolean(currentProfile) || isMismatch}
          target='profile'
          openFilePicker={openFilePicker}
          activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
          neutralImportButtonClasses={neutralImportButtonClasses}
          isImporting={isImporting}
          compact={compact}
        />
      </div>

      <button
        type='button'
        onClick={handleProfilePanelToggle}
        className={`mx-1.5 flex min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden text-center ${compact ? 'text-xs font-semibold' : 'text-sm font-bold'}`}
        title={getProfileBadgeTitle(isMismatch)}
      >
        <span className='inline-flex max-w-full items-center justify-center gap-1'>
          {isMismatch ? (
            <FontAwesomeIcon icon={faTriangleExclamation} className='mr-1 shrink-0' />
          ) : null}
          <span
            className={`truncate ${isSearchingProfile && !currentProfile ? 'italic opacity-75' : ''}`}
          >
            {cleanName(currentProfileName)}
          </span>
          {isSearchingProfile ? (
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className='shrink-0 text-[11px] opacity-60'
            />
          ) : null}
          {showProfileChevron ? (
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-[11px] opacity-40' />
          ) : null}
        </span>
      </button>

      <ProfileTrailingControl
        currentProfile={currentProfile}
        currentProfileName={currentProfileName}
        isMismatch={isMismatch}
        isSearchingProfile={isSearchingProfile}
        canRetryProfileSearch={canRetryProfileSearch}
        onRetryProfileSearch={onRetryProfileSearch}
        onShowStats={onShowStats}
        onUnloadProfile={onUnloadProfile}
        statsHref={statsHref}
        profileStatsButtonClasses={profileStatsButtonClasses}
        activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
        statisticsIcon={statisticsIcon}
      />
    </div>
  );
}

export function StatusBar({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  isShotPending = false,
  canRetryProfileSearch = false,
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
  const {
    fileInputRef,
    isDragActive,
    handleFileSelect,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openFilePicker,
  } = useStatusBarImportState({
    isImporting,
    onImportShot,
    onImportProfile,
    onImport,
  });

  const handleShotPanelToggle = onShotPanelToggle || onTogglePanel;
  const handleProfilePanelToggle = onProfilePanelToggle || onTogglePanel;

  const {
    shotBadgeClasses,
    mismatchProfileBadgeStyle,
    profileBadgeClasses,
    neutralImportButtonClasses,
    activeBadgeIconButtonClasses,
    compareBadgeIconButtonClasses,
    profileStatsButtonClasses,
    statisticsIcon,
    compareBadgeClasses,
    showShotChevron,
    showProfileChevron,
  } = getStatusBarViewModel({
    compact,
    ghosted,
    currentShot,
    compareMode,
    currentProfile,
    isMismatch,
    isSearchingProfile,
  });

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
          <ShotBadge
            currentShot={currentShot}
            currentShotName={currentShotName}
            isShotPending={isShotPending}
            compact={compact}
            shotBadgeClasses={shotBadgeClasses}
            showShotChevron={showShotChevron}
            handleShotPanelToggle={handleShotPanelToggle}
            openFilePicker={openFilePicker}
            activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
            neutralImportButtonClasses={neutralImportButtonClasses}
            isImporting={isImporting}
            showCompareButton={showCompareButton}
            compareMode={compareMode}
            compareAvailable={compareAvailable}
            compareBadgeIconButtonClasses={compareBadgeIconButtonClasses}
            onCompareModeToggle={onCompareModeToggle}
            onUnloadShot={onUnloadShot}
          />

          {/* --- CENTER: PROFILE BADGE --- */}
          <ProfileBadge
            currentProfile={currentProfile}
            currentProfileName={currentProfileName}
            compact={compact}
            profileBadgeClasses={profileBadgeClasses}
            mismatchProfileBadgeStyle={mismatchProfileBadgeStyle}
            isMismatch={isMismatch}
            showProfileChevron={showProfileChevron}
            handleProfilePanelToggle={handleProfilePanelToggle}
            openFilePicker={openFilePicker}
            activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
            neutralImportButtonClasses={neutralImportButtonClasses}
            isImporting={isImporting}
            isSearchingProfile={isSearchingProfile}
            canRetryProfileSearch={canRetryProfileSearch}
            onRetryProfileSearch={onRetryProfileSearch}
            onShowStats={onShowStats}
            onUnloadProfile={onUnloadProfile}
            statsHref={statsHref}
            profileStatsButtonClasses={profileStatsButtonClasses}
            statisticsIcon={statisticsIcon}
          />
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
