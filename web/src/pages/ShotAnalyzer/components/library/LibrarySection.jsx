/**
 * LibrarySection.jsx
 */

import { LibraryRow } from './LibraryRow';
import { LibraryActionsMenu } from './LibraryActionsMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useLingui } from '@lingui/react/macro';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faSort } from '@fortawesome/free-solid-svg-icons/faSort';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { getShotIdentityKey } from '../../utils/analyzerUtils';
import { getAnalyzerIconButtonClasses } from '../analyzerControlStyles';
import './LibrarySection.css';

function getLibraryItemKey(item, isShot) {
  return isShot ? getShotIdentityKey(item) : String(item.profileId || item.id);
}

function getLibraryColumnLayout(isShot, showCompareSelection) {
  return {
    columnCount: (showCompareSelection ? 1 : 0) + 1 + 1 + (isShot ? 1 : 0) + 1,
  };
}

function getLibraryCompareState({
  item,
  isShot,
  compareSelectionKeys,
  comparePendingKeys,
  compareReferenceKey,
  getCompareStatus,
  getCompareBadgeNumber,
}) {
  const compareKey = isShot ? getShotIdentityKey(item) : '';
  const isCompareSelected = isShot && compareSelectionKeys.has(compareKey);
  const isComparePending = isShot && comparePendingKeys.includes(compareKey);
  const isCompareReference = isShot && compareKey === compareReferenceKey;

  return {
    isCompareSelected,
    isComparePending,
    isCompareReference,
    isCompareSelectionDisabled: isComparePending || isCompareReference,
    isCompareRelated: Boolean(getCompareStatus?.(item)),
    compareBadgeNumber: getCompareBadgeNumber?.(item) || null,
  };
}

export function LibrarySection({
  title,
  items,
  isShot,
  sectionHeight,
  standalone = false,
  searchValue,
  sortKey,
  sortOrder,
  onSearchChange,
  onSortChange,
  onLoad,
  onExport,
  onDelete,
  onExportAll,
  onDeleteAll,
  onUpload,
  toolbarActions,
  hasActiveFilters = false,
  progress,
  bulkBusy = false,
  onCancel,
  ratingFilter,
  onRatingFilterChange,
  compareSelectionKeys = new Set(),
  comparePendingKeys = [],
  compareReferenceKey = '',
  compareMode = false,
  onCompareToggle,
  onShowStats,
  getMatchStatus,
  getCompareStatus,
  getCompareBadgeNumber,
  getActiveStatus,
  getPinStatus,
  getPinDisabledReason,
  onPinToggle,
  pinnedFirstEnabled = false,
  onPinnedFirstToggle,
  isLoading,
}) {
  const { t } = useLingui();

  // Keep the name column flexible because pinning and compare badges both live
  // inside that cell instead of adding separate narrow columns.
  const showCompareSelection = false;
  const { columnCount } = getLibraryColumnLayout(isShot, showCompareSelection);
  const pinnedFirstLabel = isShot ? t`Toggle pinned shots first` : t`Toggle pinned profiles first`;
  const hasCompareBadges = items.some(item => Boolean(getCompareBadgeNumber?.(item)));

  return (
    <div
      className={`library-section relative flex h-full flex-col rounded-lg border ${standalone ? 'border-transparent bg-transparent' : 'bg-base-100 border-base-content/5'}`}
      style={sectionHeight ? { height: sectionHeight } : undefined}
    >
      {/* Toolbar */}
      <div className='border-base-content/5 space-y-3 border-b p-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h3 className='text-base-content flex items-center gap-2 text-base font-bold'>
            {title}{' '}
            <span className='bg-base-content/10 rounded-full px-1.5 py-0.5 text-[10px] font-normal'>
              {items.length}
            </span>
          </h3>
          <div className='flex items-center gap-1'>
            {toolbarActions}
            <LibraryActionsMenu
              ariaLabel={isShot ? t`Open shots actions menu` : t`Open profiles actions menu`}
              label={t`More`}
              buttonClassName='h-7 w-7 p-1.5 text-sm font-medium lg:w-auto lg:gap-1.5 lg:px-2.5'
              actions={[
                {
                  label: isShot && hasActiveFilters ? t`Export Filtered Shots` : t`Export All`,
                  icon: faFileExport,
                  onSelect: onExportAll,
                  disabled: bulkBusy || Boolean(progress) || isLoading || !items.length,
                },
                {
                  label: t`Delete All`,
                  icon: faTrashCan,
                  tone: 'error',
                  onSelect: onDeleteAll,
                  disabled: bulkBusy || Boolean(progress) || isLoading || !items.length,
                },
              ]}
            />
          </div>
        </div>
        <div className='grid min-w-0 grid-cols-2 items-center gap-2 sm:flex'>
          <div className='col-span-full flex min-w-0 flex-1 items-center gap-2'>
            <div className='relative min-w-0 flex-1'>
              <FontAwesomeIcon
                icon={faSearch}
                className='text-base-content/50 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs'
              />
              <input
                type='text'
                placeholder={isShot ? t`Search shots...` : t`Search profiles...`}
                value={searchValue}
                onInput={e => onSearchChange(e.target.value)}
                className='library-toolbar-field bg-base-100 border-base-content/10 focus:border-primary h-9 w-full min-w-0 rounded-md border pr-3 pl-8 text-sm outline-none'
              />
            </div>
            {onPinnedFirstToggle && (
              <button
                type='button'
                className={getAnalyzerIconButtonClasses({
                  tone: pinnedFirstEnabled ? 'primary' : 'neutral',
                  className:
                    'library-toolbar-field bg-base-100 border-base-content/10 h-9 w-9 shrink-0 rounded-md border text-sm',
                })}
                onClick={onPinnedFirstToggle}
                aria-label={pinnedFirstLabel}
                title={pinnedFirstLabel}
                aria-pressed={pinnedFirstEnabled}
              >
                <FontAwesomeIcon icon={faThumbtack} />
              </button>
            )}
          </div>
          <div className='library-select-control'>
            <FontAwesomeIcon icon={faSort} className='text-base-content/50 shrink-0 text-xs' />
            <select
              aria-label={t`Sort`}
              title={t`Sort`}
              value={`${sortKey}-${sortOrder}`}
              onChange={e => {
                const [k, o] = e.target.value.split('-');
                onSortChange(k, o);
              }}
              className='library-toolbar-field bg-base-100 border-base-content/10 hover:bg-base-100 hover:border-base-content/20 focus:border-primary h-9 cursor-pointer rounded-md border text-xs transition-colors outline-none'
            >
              {isShot && <option value='shotDate-desc'>{t`Date (New)`}</option>}
              {isShot && <option value='shotDate-asc'>{t`Date (Old)`}</option>}
              <option value='name-asc'>{t`Name (A-Z)`}</option>
              <option value='name-desc'>{t`Name (Z-A)`}</option>
              {isShot && <option value='data.rating-desc'>{t`Rating (High)`}</option>}
              {isShot && <option value='data.rating-asc'>{t`Rating (Low)`}</option>}
              {isShot && <option value='duration-desc'>{t`Length (Long)`}</option>}
              {isShot && <option value='duration-asc'>{t`Length (Short)`}</option>}
              {isShot && <option value='volume-desc'>{t`Highest Volume`}</option>}
              {isShot && <option value='volume-asc'>{t`Lowest Volume`}</option>}
              {isShot && <option value='id-desc'>{t`Highest ID First`}</option>}
              {isShot && <option value='id-asc'>{t`Lowest ID first`}</option>}
            </select>
          </div>
          {isShot && onRatingFilterChange && (
            <div className='library-select-control'>
              <FontAwesomeIcon
                icon={faFilter}
                className={`shrink-0 text-xs ${ratingFilter !== 'all' ? 'text-primary' : 'text-base-content/50'}`}
              />
              <select
                aria-label={t`Filter by rating`}
                title={t`Filter by rating`}
                value={ratingFilter}
                onChange={event => onRatingFilterChange(event.currentTarget.value)}
                className='library-toolbar-field bg-base-100 border-base-content/10 h-9 cursor-pointer rounded-md border text-xs'
              >
                <option value='all'>{t`All`}</option>
                <option value='rated'>{t`Rated`}</option>
                <option value='unrated'>{t`Unrated`}</option>
              </select>
            </div>
          )}
        </div>
        {progress && (
          <output className='flex items-center gap-3 text-xs'>
            <span>
              {progress.deleting ? t`Deleting shots...` : t`Exporting shots...`} {progress.current}/
              {progress.total}
            </span>
            <progress
              className='progress progress-primary flex-1'
              value={progress.current}
              max={progress.total}
            />
            <button type='button' className='btn btn-sm btn-ghost' onClick={onCancel}>
              <Trans>Cancel</Trans>
            </button>
          </output>
        )}
      </div>

      <div
        className={`relative scrollbar-thin overflow-y-auto px-2 ${sectionHeight ? 'min-h-0 flex-1' : 'h-96 lg:h-auto lg:min-h-0 lg:flex-1'}`}
        style={{ scrollbarGutter: 'stable' }}
      >
        {isLoading && (
          <div
            className={`absolute inset-0 z-20 flex items-center justify-center ${standalone ? 'bg-transparent' : 'bg-base-100/90'}`}
          >
            <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary text-3xl' />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <p className='p-6 text-center text-sm opacity-60'>
            <Trans>No shots or profiles match the current filters.</Trans>
          </p>
        )}
        <table className='relative w-full border-separate border-spacing-0'>
          <tbody className='text-sm'>
            {hasCompareBadges ? (
              <tr>
                <td colSpan={columnCount} className='h-1.5 p-0' />
              </tr>
            ) : null}
            {items.map(item => {
              const {
                isCompareSelected,
                isComparePending,
                isCompareReference,
                isCompareSelectionDisabled,
                isCompareRelated,
                compareBadgeNumber,
              } = getLibraryCompareState({
                item,
                isShot,
                compareSelectionKeys,
                comparePendingKeys,
                compareReferenceKey,
                getCompareStatus,
                getCompareBadgeNumber,
              });

              return (
                <LibraryRow
                  key={getLibraryItemKey(item, isShot)}
                  item={item}
                  isShot={isShot}
                  compareBadgeNumber={compareBadgeNumber}
                  isMatch={getMatchStatus(item)}
                  isCompareRelated={isCompareRelated}
                  isActive={getActiveStatus ? getActiveStatus(item) : false}
                  showCompareSelection={showCompareSelection}
                  isCompareSelected={isCompareSelected}
                  isComparePending={isComparePending}
                  isCompareReference={isCompareReference}
                  isCompareSelectionDisabled={isCompareSelectionDisabled}
                  compareMode={compareMode}
                  onCompareToggle={checked => onCompareToggle?.(item, checked)}
                  onShowStats={onShowStats}
                  onLoad={() => onLoad(item)}
                  onExport={onExport}
                  onUpload={onUpload}
                  actionsDisabled={Boolean(progress)}
                  onDelete={onDelete}
                  isPinned={Boolean(getPinStatus?.(item))}
                  pinDisabledReason={getPinDisabledReason?.(item) || ''}
                  onPinToggle={onPinToggle}
                  columnCount={columnCount}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
