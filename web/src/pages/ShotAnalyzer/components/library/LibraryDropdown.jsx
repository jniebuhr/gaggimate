import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { libraryService } from '../../services/LibraryService';
import {
  cleanName,
  getShotIdentityKey,
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
          <Trans>Shots</Trans>
        </button>
        <button
          type='button'
          className={getTabClassName('profiles')}
          onClick={() => onSectionChange('profiles')}
        >
          <Trans>Profiles</Trans>
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
        aria-label={t`Close library`}
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
  onExportAll,
  onDeleteAll,
  onUpload,
  inlineActions,
  toolbarActions,
  hasActiveFilters,
  progress,
  onCancel,
  ratingFilter,
  onRatingFilterChange,
  setShotsPinnedFirst,
  setShotsSearch,
  setShotsSort,
  shots,
  shotsPinnedFirst,
  shotsSearch,
  shotsSort,
}) {
  return (
    <div
      className={
        inlineActions ? 'mt-4' : getLibrarySectionVisibilityClass(mobileActiveSection, 'shots')
      }
    >
      <LibrarySection
        title={t`Shots`}
        standalone={inlineActions}
        onUpload={onUpload}
        toolbarActions={toolbarActions}
        hasActiveFilters={hasActiveFilters}
        progress={progress}
        onCancel={onCancel}
        ratingFilter={ratingFilter}
        onRatingFilterChange={onRatingFilterChange}
        items={shots}
        isShot={true}
        compareMode={compareMode}
        sectionHeight={desktopSectionHeight}
        searchValue={shotsSearch}
        sortKey={shotsSort.key}
        sortOrder={shotsSort.order}
        onSearchChange={setShotsSearch}
        onSortChange={(key, order) => setShotsSort(getNextLibrarySortState(shotsSort, key, order))}
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
        onExportAll={onExportAll}
        onDeleteAll={onDeleteAll}
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
  busy = false,
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
  refreshLibraries,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
  setProfilesPinnedFirst,
  setProfilesSearch,
  setProfilesSort,
}) {
  const handleExportAllProfiles = () => {
    if (busy) return;
    if (profiles.length === 0) return;
    const count = profiles.length;
    if (
      confirm(
        t`Do you really want to export all ${count} filtered profiles? (Profiles are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < profiles.length; i++)
        setTimeout(() => handleExport(profiles[i], false), i * 300);
    }
  };

  const handleDeleteAllProfiles = async () => {
    if (busy) return;
    const count = profiles.length;
    if (
      confirm(t`WARNING: Do you really want to IRREVOCABLY delete all ${count} filtered profiles?`)
    ) {
      for (const profile of profiles) {
        await libraryService.deleteProfile(getLibraryProfileDeleteKey(profile)); // NOSONAR -- Keep controller mutations sequential.
      }
      await refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'profiles')}>
      <LibrarySection
        title={t`Profiles`}
        bulkBusy={busy}
        items={profiles}
        isShot={false}
        compareMode={compareMode}
        sectionHeight={desktopSectionHeight}
        searchValue={profilesSearch}
        sortKey={profilesSort.key}
        sortOrder={profilesSort.order}
        onSearchChange={setProfilesSearch}
        onSortChange={(key, order) =>
          setProfilesSort(getNextLibrarySortState(profilesSort, key, order))
        }
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
