/**
 * StatusBar.jsx
 * * Merges seamlessly with the dropdown when expanded.
 */

import { useRef, useState } from 'preact/hooks';
import { cleanName, analyzerUiColors } from '../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';

function hasFileDrag(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  if (Array.isArray(types)) return types.includes('Files');
  if (typeof types.contains === 'function') return types.contains('Files');
  return false;
}

function getProfileBadgeClasses({ isMismatch, currentProfile, badgeBaseClass }) {
  if (isMismatch) return `${badgeBaseClass} text-white`;
  if (currentProfile) return `${badgeBaseClass} bg-primary border-primary text-primary-content`;
  return `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;
}

function getProfileBadgeTitle(isMismatch) {
  if (isMismatch) {
    return 'Profile mismatch detected. Use the import icon or drop files here to import.';
  }
  return 'Click to open the library. Use the import icon or drop files here to import.';
}

export function StatusBar({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  onUnloadShot,
  onUnloadProfile,
  onTogglePanel,
  onImport,
  isMismatch,
  isImporting = false, // Show spinner on import button
  isSearchingProfile = false, // Show spinner on profile badge
}) {
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const clearDragState = () => {
    dragDepthRef.current = 0;
    setIsDragActive(false);
  };

  const openFilePicker = event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (isImporting) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = e => {
    const files = e.target.files;
    if (files && files.length > 0) {
      clearDragState();
      onImport(files);
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
    if (files && files.length > 0) {
      onImport(files);
    }
  };

  // Shared styling for badges
  const badgeBaseClass =
    'flex items-center justify-between flex-1 px-2 sm:px-3 h-full rounded-lg border-2 cursor-pointer transition-all min-w-0 shadow-sm';

  const shotBadgeClasses = currentShot
    ? `${badgeBaseClass} bg-primary border-primary text-primary-content`
    : `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;

  const mismatchProfileBadgeStyle = isMismatch
    ? {
        backgroundColor: analyzerUiColors.warningOrange,
        borderColor: analyzerUiColors.warningOrangeStrong,
        boxShadow: `0 1px 2px 0 ${analyzerUiColors.warningOrangeShadow}`,
      }
    : undefined;

  const profileBadgeClasses = getProfileBadgeClasses({
    isMismatch,
    currentProfile,
    badgeBaseClass,
  });

  const neutralImportButtonClasses = getAnalyzerIconButtonClasses({
    className: 'h-6 w-6 flex-shrink-0 rounded-full opacity-75 hover:opacity-100',
  });

  const activeBadgeIconButtonClasses = getAnalyzerIconButtonClasses({
    className:
      'h-6 w-6 flex-shrink-0 rounded-full text-current opacity-75 hover:bg-black/10 hover:text-current hover:opacity-100',
  });

  const renderImportButton = (label, useCurrentTone = false) => (
    <button
      type='button'
      onClick={openFilePicker}
      className={useCurrentTone ? activeBadgeIconButtonClasses : neutralImportButtonClasses}
      title={`Import ${label}`}
      aria-label={`Import ${label}`}
      disabled={isImporting}
    >
      <FontAwesomeIcon
        icon={isImporting ? faCircleNotch : faFileImport}
        spin={isImporting}
        className='text-sm'
      />
    </button>
  );

  const renderProfileTrailingControl = () => {
    if (currentProfile) {
      if (isSearchingProfile) {
        return <FontAwesomeIcon icon={faCircleNotch} spin className='text-xs opacity-70' />;
      }

      return (
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
      );
    }

    if (isSearchingProfile) {
      return <FontAwesomeIcon icon={faCircleNotch} spin className='text-xs opacity-70' />;
    }

    return <FontAwesomeIcon icon={faChevronDown} className='text-xs opacity-40' />;
  };

  return (
    <div
      className='w-full'
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className='relative px-1.5 py-1.5 sm:px-2'>
        <div
          className={`grid h-11 w-full items-center gap-1 rounded-xl transition-all sm:gap-1.5 ${
            isDragActive ? 'bg-primary/8 ring-primary/30 shadow-lg ring-2' : ''
          }`}
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          }}
        >
          {/* --- CENTER: SHOT BADGE --- */}
          <div
            className={shotBadgeClasses}
            title='Click to open the library. Use the import icon or drop files here to import.'
          >
            <div className='flex flex-shrink-0 items-center gap-2'>
              {renderImportButton('files into the Shot Analyzer', Boolean(currentShot))}
            </div>
            <button
              type='button'
              onClick={onTogglePanel}
              className='mx-1.5 flex-1 truncate text-center text-sm font-bold'
              title='Open library'
            >
              {currentShot?.source === 'gaggimate'
                ? `#${currentShot.id}`
                : cleanName(currentShotName)}
            </button>
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
            ) : (
              <FontAwesomeIcon icon={faChevronDown} className='text-xs opacity-40' />
            )}
          </div>

          {/* --- CENTER: PROFILE BADGE --- */}
          <div
            className={profileBadgeClasses}
            style={mismatchProfileBadgeStyle}
            title={getProfileBadgeTitle(isMismatch)}
          >
            <div className='flex flex-shrink-0 items-center gap-2'>
              {renderImportButton(
                'files into the Shot Analyzer',
                Boolean(currentProfile) || isMismatch,
              )}
            </div>

            <button
              type='button'
              onClick={onTogglePanel}
              className='mx-1.5 flex-1 truncate text-center text-sm font-bold'
              title={getProfileBadgeTitle(isMismatch)}
            >
              {isSearchingProfile && !currentProfile ? (
                <span className='italic opacity-50'>Searching Profile...</span>
              ) : (
                <>
                  {isMismatch && <FontAwesomeIcon icon={faTriangleExclamation} className='mr-2' />}
                  {cleanName(currentProfileName)}
                </>
              )}
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
