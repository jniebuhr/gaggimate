/**
 * StatusBar.jsx
 * * Merges seamlessly with the dropdown when expanded.
 */

import { cleanName, analyzerUiColors } from '../../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons/faRotateRight';
import { getAnalyzerIconButtonClasses } from '../analyzerControlStyles';

function getProfileBadgeClasses({ isMismatch, currentProfile, badgeBaseClass, loadedShadowClass }) {
  if (isMismatch) return `${badgeBaseClass} ${loadedShadowClass} border-transparent text-white`;
  if (currentProfile) {
    return `${badgeBaseClass} ${loadedShadowClass} bg-primary border-primary text-primary-content`;
  }
  return `${badgeBaseClass} border-base-content/15 bg-transparent text-base-content/70 shadow-none hover:bg-base-content/5`;
}

function getShotBadgeClasses({ ghosted, badgeBaseClass, currentShot }) {
  if (ghosted) {
    return getGhostedBadgeClasses(badgeBaseClass, Boolean(currentShot));
  }
  if (currentShot) {
    return `${badgeBaseClass} bg-primary border-primary text-primary-content`;
  }
  return `${badgeBaseClass} border-base-content/15 bg-transparent text-base-content/70 shadow-none hover:bg-base-content/5`;
}

function getGhostedBadgeClasses(baseClasses, isActive) {
  if (isActive) {
    // Secondary compare slots stay visually tied to the active theme while
    // remaining lighter than the primary bar.
    return `${baseClasses} bg-primary/24 border-transparent text-primary hover:bg-primary/30 shadow-none`;
  }
  return `${baseClasses} border-base-content/10 bg-transparent text-base-content/65 hover:bg-base-content/5 shadow-none`;
}

function getProfileBadgeTitle(isMismatch) {
  if (isMismatch) {
    return 'Profile mismatch detected. Use Import below or drop files here to import.';
  }
  return 'Click to open the library. Use Import below or drop files here to import.';
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

function getMismatchProfileBadgeStyle({ isMismatch, ghosted }) {
  if (!isMismatch) return undefined;

  return {
    backgroundColor: ghosted
      ? `color-mix(in srgb, ${analyzerUiColors.warningOrange} 34%, transparent)`
      : analyzerUiColors.warningOrange,
  };
}

function getStatusBarIconButtonClassSet({ compact, ghosted }) {
  return {
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
  isSearchingProfile,
}) {
  const badgeBaseClass = compact
    ? 'flex items-center justify-between flex-1 px-2 h-full rounded-md border cursor-pointer transition-all min-w-0'
    : 'flex items-center justify-between flex-1 px-2 sm:px-3 h-full rounded-lg border cursor-pointer transition-all min-w-0';
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

  const { activeBadgeIconButtonClasses } = getStatusBarIconButtonClassSet({
    compact,
    ghosted,
  });

  return {
    shotBadgeClasses,
    mismatchProfileBadgeStyle,
    profileBadgeClasses,
    activeBadgeIconButtonClasses,
    compareBadgeClasses: getCompareSlotBadgeClasses({ currentShot, ghosted }),
    showShotChevron: true,
    showProfileChevron: Boolean(currentProfile) || !isSearchingProfile,
  };
}

function ProfileTrailingControl({
  currentProfile,
  currentProfileName,
  isMismatch,
  isSearchingProfile,
  canRetryProfileSearch,
  onRetryProfileSearch,
  onUnloadProfile,
  activeBadgeIconButtonClasses,
}) {
  const retryTitle = 'Retry automatic profile search';
  const hasDismissibleProfileState =
    isSearchingProfile || cleanName(currentProfileName || '').toLowerCase() !== 'no profile loaded';

  if (currentProfile) {
    const showRetry = (isMismatch || canRetryProfileSearch) && onRetryProfileSearch;

    return (
      <div className='flex items-center gap-1'>
        {showRetry ? (
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

function BadgeExportControl({ available, activeBadgeIconButtonClasses, onExport, label }) {
  if (!available || !onExport) return null;

  return (
    <button
      type='button'
      onClick={event => {
        event.stopPropagation();
        onExport();
      }}
      className={activeBadgeIconButtonClasses}
      title={label}
      aria-label={label}
    >
      <FontAwesomeIcon icon={faFileExport} />
    </button>
  );
}

function ShotTrailingControl({ currentShot, activeBadgeIconButtonClasses, onUnloadShot }) {
  return (
    <div className='flex items-center gap-1'>
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
  activeBadgeIconButtonClasses,
  onUnloadShot,
  onExportShot,
}) {
  return (
    <div
      data-import-target='shot'
      className={shotBadgeClasses}
      title='Click to open the library. Use Import below or drop files here to import.'
    >
      <BadgeExportControl
        available={Boolean(currentShot)}
        activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
        onExport={onExportShot}
        label='Export current shot'
      />
      <button
        type='button'
        onClick={handleShotPanelToggle}
        className={`mx-1.5 flex min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden text-center ${compact ? 'text-xs font-medium' : 'text-sm font-semibold'}`}
        title='Open library'
      >
        <span className='inline-flex max-w-full min-w-0 flex-1 items-center justify-center gap-1'>
          <span className='min-w-0 truncate'>
            {getShotBadgeLabel(currentShot, currentShotName)}
          </span>
          {isShotPending ? (
            <FontAwesomeIcon icon={faCircleNotch} spin className='shrink-0 text-xs opacity-60' />
          ) : null}
          {showShotChevron ? (
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-xs opacity-40' />
          ) : null}
        </span>
      </button>
      <ShotTrailingControl
        currentShot={currentShot}
        activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
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
  activeBadgeIconButtonClasses,
  isSearchingProfile,
  canRetryProfileSearch,
  onRetryProfileSearch,
  onUnloadProfile,
  onExportProfile,
}) {
  return (
    <div
      data-import-target='profile'
      className={profileBadgeClasses}
      style={mismatchProfileBadgeStyle}
      title={getProfileBadgeTitle(isMismatch)}
    >
      <BadgeExportControl
        available={Boolean(currentProfile)}
        activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
        onExport={onExportProfile}
        label='Export current profile'
      />
      <button
        type='button'
        onClick={handleProfilePanelToggle}
        className={`mx-1.5 flex min-w-0 flex-1 items-center justify-center self-stretch overflow-hidden text-center ${compact ? 'text-xs font-medium' : 'text-sm font-semibold'}`}
        title={getProfileBadgeTitle(isMismatch)}
      >
        <span className='inline-flex max-w-full min-w-0 flex-1 items-center justify-center gap-1'>
          {isMismatch ? (
            <FontAwesomeIcon icon={faTriangleExclamation} className='mr-1 shrink-0' />
          ) : null}
          <span
            className={`min-w-0 truncate ${isSearchingProfile && !currentProfile ? 'italic opacity-75' : ''}`}
          >
            {cleanName(currentProfileName)}
          </span>
          {isSearchingProfile ? (
            <FontAwesomeIcon icon={faCircleNotch} spin className='shrink-0 text-xs opacity-60' />
          ) : null}
          {showProfileChevron ? (
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-xs opacity-40' />
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
        onUnloadProfile={onUnloadProfile}
        activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
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
  onExportShot,
  onExportProfile,
  onRetryProfileSearch,
  onTogglePanel,
  onShotPanelToggle,
  onProfilePanelToggle,
  isMismatch,
  compareMode = false,
  isSearchingProfile = false, // Show spinner on profile badge
  compact = false,
  compareBadgeNumber = null,
  ghosted = false,
}) {
  const handleShotPanelToggle = onShotPanelToggle || onTogglePanel;
  const handleProfilePanelToggle = onProfilePanelToggle || onTogglePanel;

  const {
    shotBadgeClasses,
    mismatchProfileBadgeStyle,
    profileBadgeClasses,
    activeBadgeIconButtonClasses,
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
    <div className='relative w-full overflow-visible'>
      {compareBadgeNumber ? (
        <span
          className={`pointer-events-none absolute top-0 left-1 z-10 inline-flex h-4 min-w-4 -translate-x-1/3 -translate-y-1/4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold shadow-md ring-2 ${compareBadgeClasses}`}
        >
          {compareBadgeNumber}
        </span>
      ) : null}
      <div className={`relative ${compact ? 'px-1.5 py-0.5 sm:px-2' : 'px-1.5 py-1.5 sm:px-2'}`}>
        <div
          className={`grid ${compact ? 'h-7 rounded-lg' : 'h-9 min-h-9 rounded-lg'} w-full items-center gap-1 transition-all sm:gap-1.5`}
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
            activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
            onUnloadShot={onUnloadShot}
            onExportShot={onExportShot}
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
            activeBadgeIconButtonClasses={activeBadgeIconButtonClasses}
            isSearchingProfile={isSearchingProfile}
            canRetryProfileSearch={canRetryProfileSearch}
            onRetryProfileSearch={onRetryProfileSearch}
            onUnloadProfile={onUnloadProfile}
            onExportProfile={onExportProfile}
          />
        </div>
      </div>
    </div>
  );
}
