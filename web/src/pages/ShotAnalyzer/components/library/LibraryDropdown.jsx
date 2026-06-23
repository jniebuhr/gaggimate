import { libraryService } from '../../services/LibraryService';
import {
  cleanName,
  getShotIdentityKey,
  getShotStorageKey,
  isProfilePinned,
  isShotPinned,
} from '../../utils/analyzerUtils';
import { getAnalyzerTextButtonClasses } from '../analyzerControlStyles';
import { LibrarySection } from './LibrarySection';
import { doesProfileLabelMatchShot, doesProfileMatchProfile } from './libraryData';
import {
  getLibraryProfileDeleteKey,
  getProfileCompareBadgeNumber,
  getShotCompareBadgeNumber,
} from './libraryDisplay';

function getNextLibrarySortState(currentSort, key, order) {
  return {
    key,
    order: order || (currentSort.key === key && currentSort.order === 'desc' ? 'asc' : 'desc'),
  };
}

function getLibrarySectionVisibilityClass(activeSection, section) {
  return activeSection === section ? 'block lg:block' : 'hidden lg:block';
}

function LibraryMobileSectionTabs({ activeSection, onSectionChange }) {
  const getTabClassName = section =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
      activeSection === section
        ? 'bg-base-100 text-base-content shadow-sm'
        : getAnalyzerTextButtonClasses({
            className: 'justify-center',
          })
    }`;

  return (
    <div className='px-4 pt-4 lg:hidden'>
      <div className='bg-base-200/60 flex items-center gap-1 rounded-lg p-1'>
        <button
          type='button'
          className={getTabClassName('shots')}
          onClick={() => onSectionChange('shots')}
        >
          Shots
        </button>
        <button
          type='button'
          className={getTabClassName('profiles')}
          onClick={() => onSectionChange('profiles')}
        >
          Profiles
        </button>
      </div>
    </div>
  );
}

export function LibraryDropdown({
  children,
  dropdownStyle,
  mobileActiveSection,
  onClose,
  onMobileSectionChange,
}) {
  return (
    <>
      <button
        type='button'
        className='fixed inset-0 cursor-pointer border-0 bg-black/20 p-0'
        style={{ zIndex: 40 }}
        onClick={onClose}
        aria-label='Close library'
      />
      <div style={dropdownStyle}>
        <div className='library-panel-dropdown-surface app-card-surface animate-fade-in-down origin-top overflow-hidden rounded-b-xl'>
          <LibraryMobileSectionTabs
            activeSection={mobileActiveSection}
            onSectionChange={onMobileSectionChange}
          />
          <div className='max-h-[75vh] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-hidden'>
            <div className='grid grid-cols-1 gap-x-4 gap-y-4 p-4 lg:grid-cols-2 lg:gap-x-1.5'>
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function LibraryShotsPanelSection({
  compareMode,
  comparePendingKeys,
  compareSecondaryShotKey,
  compareSelectedCount,
  compareSelectionKeys,
  desktopSectionHeight,
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  getShotPinDisabledReason,
  handleDelete,
  handleExport,
  handleShotPinToggle,
  handleShotRowAction,
  loading,
  mobileActiveSection,
  normalizedCurrentProfileName,
  onCompareShotToggle,
  pinnedShotsByProfile,
  primaryDisplayProfile,
  primaryDisplayShot,
  refreshLibraries,
  setShotsPinnedFirst,
  setShotsSearch,
  setShotsSort,
  setShotsSourceFilter,
  shots,
  shotsPinnedFirst,
  shotsSearch,
  shotsSort,
  shotsSourceFilter,
}) {
  const handleExportAllShots = () => {
    if (shots.length === 0) return;
    if (
      confirm(
        `Do you really want to export all ${shots.length} filtered shots? (Shots are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < shots.length; i++)
        setTimeout(() => handleExport(shots[i], true), i * 300);
    }
  };

  const handleDeleteAllShots = async () => {
    if (
      confirm(
        `WARNING: Do you really want to IRREVOCABLY delete all ${shots.length} filtered shots?`,
      )
    ) {
      for (const shot of shots) {
        await libraryService.deleteShot(getShotStorageKey(shot), shot.source);
      }
      refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'shots')}>
      <LibrarySection
        title='Shots'
        items={shots}
        isShot={true}
        compareMode={compareMode}
        sectionHeight={desktopSectionHeight}
        searchValue={shotsSearch}
        sortKey={shotsSort.key}
        sortOrder={shotsSort.order}
        sourceFilter={shotsSourceFilter}
        onSearchChange={setShotsSearch}
        onSortChange={(key, order) => setShotsSort(getNextLibrarySortState(shotsSort, key, order))}
        onSourceFilterChange={setShotsSourceFilter}
        onLoad={handleShotRowAction}
        onExport={item => handleExport(item, true)}
        onDelete={handleDelete}
        compareSelectedCount={compareSelectedCount}
        compareSelectionKeys={compareSelectionKeys}
        comparePendingKeys={comparePendingKeys}
        compareReferenceKey={primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : ''}
        getCompareBadgeNumber={item =>
          getShotCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayShot,
            compareSecondaryShotKey,
          })
        }
        onCompareToggle={onCompareShotToggle}
        isLoading={loading}
        onExportAll={handleExportAllShots}
        onDeleteAll={handleDeleteAllShots}
        getMatchStatus={item =>
          primaryDisplayProfile &&
          cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName
        }
        getActiveStatus={item =>
          primaryDisplayShot &&
          getShotIdentityKey(item) === getShotIdentityKey(primaryDisplayShot) &&
          item.source === primaryDisplayShot.source
        }
        getPinStatus={item =>
          shotsPinnedFirst
            ? Boolean(getPinnedShotBucketKey(item))
            : isShotPinned(item, getEffectiveShotPinBucketKey(item), pinnedShotsByProfile)
        }
        getPinDisabledReason={getShotPinDisabledReason}
        pinnedFirstEnabled={shotsPinnedFirst}
        onPinnedFirstToggle={() => setShotsPinnedFirst(value => !value)}
        onPinToggle={handleShotPinToggle}
      />
    </div>
  );
}

export function LibraryProfilesPanelSection({
  compareMode,
  desktopSectionHeight,
  getProfilePinDisabledReason,
  handleDelete,
  handleExport,
  handleLibraryProfileStatsOpen,
  handleProfilePinToggle,
  handleProfileRowAction,
  loading,
  mobileActiveSection,
  normalizedCompareSecondaryProfileName,
  pinnedProfiles,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
  profiles,
  profilesPinnedFirst,
  profilesSearch,
  profilesSort,
  profilesSourceFilter,
  refreshLibraries,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
  setProfilesPinnedFirst,
  setProfilesSearch,
  setProfilesSort,
  setProfilesSourceFilter,
}) {
  const handleExportAllProfiles = () => {
    if (profiles.length === 0) return;
    if (
      confirm(
        `Do you really want to export all ${profiles.length} filtered profiles? (Profiles are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < profiles.length; i++)
        setTimeout(() => handleExport(profiles[i], false), i * 300);
    }
  };

  const handleDeleteAllProfiles = async () => {
    if (
      confirm(
        `WARNING: Do you really want to IRREVOCABLY delete all ${profiles.length} filtered profiles?`,
      )
    ) {
      for (const profile of profiles) {
        await libraryService.deleteProfile(getLibraryProfileDeleteKey(profile), profile.source);
      }
      refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'profiles')}>
      <LibrarySection
        title='Profiles'
        items={profiles}
        isShot={false}
        compareMode={compareMode}
        sectionHeight={desktopSectionHeight}
        searchValue={profilesSearch}
        sortKey={profilesSort.key}
        sortOrder={profilesSort.order}
        sourceFilter={profilesSourceFilter}
        onSearchChange={setProfilesSearch}
        onSortChange={(key, order) =>
          setProfilesSort(getNextLibrarySortState(profilesSort, key, order))
        }
        onSourceFilterChange={setProfilesSourceFilter}
        onLoad={handleProfileRowAction}
        onShowStats={handleLibraryProfileStatsOpen}
        onExport={item => handleExport(item, false)}
        onDelete={handleDelete}
        isLoading={loading}
        onExportAll={handleExportAllProfiles}
        onDeleteAll={handleDeleteAllProfiles}
        getMatchStatus={item =>
          primaryDisplayShot && doesProfileLabelMatchShot(item, primaryDisplayShot)
        }
        getCompareStatus={item =>
          Boolean(
            secondaryDisplayProfileName &&
              normalizedCompareSecondaryProfileName &&
              normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
              doesProfileLabelMatchShot(item, secondaryDisplayShot),
          )
        }
        getCompareBadgeNumber={item =>
          getProfileCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayProfile,
            primaryDisplayProfileName,
            secondaryDisplayProfile,
            secondaryDisplayProfileName,
          })
        }
        getActiveStatus={item =>
          primaryDisplayProfile &&
          doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
        }
        getPinStatus={item => isProfilePinned(item, pinnedProfiles)}
        getPinDisabledReason={getProfilePinDisabledReason}
        pinnedFirstEnabled={profilesPinnedFirst}
        onPinnedFirstToggle={() => setProfilesPinnedFirst(value => !value)}
        onPinToggle={handleProfilePinToggle}
      />
    </div>
  );
}
