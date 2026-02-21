/**
 * StatusBar.jsx
 * * Merges seamlessly with the dropdown when expanded.
 */

import { cleanName } from '../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons/faFolderOpen';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faChartLine } from '@fortawesome/free-solid-svg-icons/faChartLine';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';

export function StatusBar({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  onUnloadShot,
  onUnloadProfile,
  onTogglePanel,
  onImport,
  onShowStats,
  isMismatch,
  importMode = 'temp',
  onImportModeChange,
  isExpanded = false,
  isImporting = false, // Show spinner on import button
  isSearchingProfile = false, // Show spinner on profile badge
  hasNotesBar = false, // Whether NotesBar is rendered below
}) {
  const handleFileSelect = e => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImport(files);
      e.target.value = '';
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onImport(files);
    }
  };

  // Shared styling for badges
  const badgeBaseClass =
    'flex items-center justify-between flex-1 px-3 sm:px-4 h-full rounded-lg border-2 cursor-pointer transition-all min-w-0 shadow-sm';

  const shotBadgeClasses = currentShot
    ? `${badgeBaseClass} bg-primary border-primary text-primary-content`
    : `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;

  // Updated Badge Logic: If searching, keep it neutral but show activity
  const profileBadgeClasses = isMismatch
    ? `${badgeBaseClass} bg-orange-500 border-orange-600 text-white shadow-orange-500/30`
    : currentProfile && !isSearchingProfile
      ? `${badgeBaseClass} bg-secondary border-secondary text-secondary-content`
      : `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;

  return (
    <div className='w-full'>
      <div className='p-2'>
        <div
          className='grid h-12 w-full items-center gap-1 sm:gap-2'
          style={{
            gridTemplateColumns:
              'minmax(6.5rem, 1fr) minmax(0, 2.15fr) minmax(0, 2.15fr) minmax(6.5rem, 1fr)',
          }}
        >
          {/* --- LEFT: IMPORT + MODE TOGGLE (outer column, symmetric with stats) --- */}
          <div
            className='border-primary/50 bg-base-100/50 hover:border-primary group flex h-full min-w-0 overflow-hidden rounded-lg border-2 border-dashed shadow-sm transition-all'
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <label className='hover:bg-primary/10 text-primary border-base-content/10 flex h-full min-w-[2.25rem] flex-1 cursor-pointer items-center justify-center border-r transition-colors sm:min-w-[3.25rem]'>
              {/* Import Spinner */}
              {isImporting ? (
                <FontAwesomeIcon icon={faCircleNotch} spin className='text-xl opacity-60' />
              ) : (
                <FontAwesomeIcon icon={faFileImport} className='text-xl' />
              )}
              <input
                type='file'
                multiple
                accept='.slog,.json'
                onChange={handleFileSelect}
                className='hidden'
                disabled={isImporting}
              />
            </label>

            <button
              onClick={e => {
                e.preventDefault();
                onImportModeChange(importMode === 'browser' ? 'temp' : 'browser');
              }}
              className='bg-base-100/50 text-base-content/70 hover:bg-primary flex h-full min-w-[3rem] flex-col items-center justify-center px-0.5 transition-colors hover:text-white sm:min-w-[4.25rem] sm:px-1'
              title='Toggle between Browser and Temporary mode'
            >
              <span className='text-[10px] leading-tight font-bold tracking-wide uppercase'>
                {importMode === 'browser' ? 'Save' : 'View'}
              </span>
              <span className='scale-90 text-[9px] leading-tight whitespace-nowrap opacity-70'>
                {importMode === 'browser' ? 'in Browser' : 'Temporarily'}
              </span>
            </button>
          </div>

          {/* --- CENTER: SHOT BADGE --- */}
          <div className={shotBadgeClasses} onClick={onTogglePanel} title='Click to toggle library'>
            <FontAwesomeIcon icon={faFolderOpen} className='opacity-70' />
            <span className='mx-2 flex-1 truncate text-center text-sm font-bold'>
              {currentShot?.source === 'gaggimate' ? `#${currentShot.id}` : cleanName(currentShotName)}
            </span>
            {currentShot ? (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onUnloadShot();
                }}
                className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-current opacity-60 transition-all hover:bg-black/10 hover:opacity-100'
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            ) : (
              <FontAwesomeIcon icon={faChevronDown} className='text-xs opacity-40' />
            )}
          </div>

          {/* --- CENTER: PROFILE BADGE --- */}
          <div
            className={profileBadgeClasses}
            onClick={onTogglePanel}
            title={isMismatch ? 'Profile mismatch detected!' : 'Click to toggle library'}
          >
            {/* Profile Search Spinner replaces Folder Icon */}
            {isSearchingProfile ? (
              <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary opacity-70' />
            ) : (
              <FontAwesomeIcon icon={faFolderOpen} className='opacity-70' />
            )}

            <span className='mx-2 flex-1 truncate text-center text-sm font-bold'>
              {/* Show "Searching..." text if actively searching, otherwise normal name */}
              {isSearchingProfile ? (
                <span className='italic opacity-50'>Searching Profile...</span>
              ) : (
                <>
                  {isMismatch && <FontAwesomeIcon icon={faTriangleExclamation} className='mr-2' />}
                  {cleanName(currentProfileName)}
                </>
              )}
            </span>

            {currentProfile && !isSearchingProfile ? (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onUnloadProfile();
                }}
                className='flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-current opacity-60 transition-all hover:bg-black/10 hover:opacity-100'
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            ) : (
              !isSearchingProfile && (
                <FontAwesomeIcon icon={faChevronDown} className='text-xs opacity-40' />
              )
            )}
          </div>

          {/* --- RIGHT: STATS BUTTON (outer column, symmetric with import block) --- */}
          <button
            className='border-success/50 text-success hover:bg-success hover:border-success bg-base-100/50 flex h-full w-full min-w-0 items-center justify-center rounded-lg border-2 shadow-sm transition-all hover:text-white'
            onClick={onShowStats}
            title='Compare & Statistics'
          >
            <FontAwesomeIcon icon={faChartLine} className='text-xl' />
          </button>
        </div>
      </div>
    </div>
  );
}
