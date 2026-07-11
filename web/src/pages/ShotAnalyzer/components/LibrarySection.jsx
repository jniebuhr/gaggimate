/**
 * LibrarySection.jsx
 */

import { LibraryRow } from './LibraryRow';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { getShotIdentityKey } from '../utils/analyzerUtils';
import {
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
} from './analyzerControlStyles';
import { SourceMarker } from './SourceMarker';

function getLibraryItemKey(item, isShot) {
  if (!item) return 'unknown-item';

  if (isShot) {
    if (item.source === 'gaggimate') return `gaggimate-shot:${String(item.id || '')}`;
    return `browser-shot:${String(item.storageKey || item.name || item.id || '')}`;
  }

  if (item.source === 'gaggimate') {
    return `gaggimate-profile:${String(
      item.profileId ||
        item.id ||
        item.label ||
        item.name ||
        item.fileName ||
        item.exportName ||
        '',
    )}`;
  }

  return `browser-profile:${String(
    item.label || item.name || item.fileName || item.exportName || item.id || '',
  )}`;
}

const SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'ALL' },
  { value: 'gaggimate', label: 'GM' },
  { value: 'browser', label: 'WEB' },
];

function closeParentDetails(target) {
  const details = target.closest('details');
  if (details) details.open = false;
}

function renderLibrarySourceOptionContent(value) {
  if (value === 'gaggimate') {
    return (
      <span className='inline-flex items-center gap-1.5'>
        <SourceMarker source='gaggimate' variant='compact' />
        <span>GM</span>
      </span>
    );
  }

  if (value === 'browser') {
    return (
      <span className='inline-flex items-center gap-1.5'>
        <SourceMarker source='browser' variant='compact' />
        <span>WEB</span>
      </span>
    );
  }

  return <span>ALL</span>;
}

function renderLibrarySourceHeaderContent(value) {
  if (value === 'gaggimate' || value === 'browser') {
    return <SourceMarker source={value} variant='compact' />;
  }

  return (
    <span className='inline-flex items-center gap-1'>
      <SourceMarker source='gaggimate' variant='compact' />
      <SourceMarker source='browser' variant='compact' />
    </span>
  );
}

function getNameColumnWidth(isShot, showCompareSelection) {
  if (!isShot) return '55%';
  return showCompareSelection ? '24%' : '30%';
}

function getLibraryColumnLayout(isShot, showCompareSelection) {
  return {
    widthCompare: showCompareSelection ? '6%' : '0%',
    widthName: getNameColumnWidth(isShot, showCompareSelection),
    widthSource: '7%',
    widthDate: isShot ? '25%' : '0%',
    widthProfile: isShot ? '25%' : '0%',
    widthAction: '10%',
    columnCount: (showCompareSelection ? 1 : 0) + 1 + 1 + (isShot ? 2 : 0) + 1,
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
  searchValue,
  sortKey,
  sortOrder,
  sourceFilter,
  onSearchChange,
  onSortChange,
  onSourceFilterChange,
  onLoad,
  onExport,
  onDelete,
  onExportAll,
  onDeleteAll,
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
  const getSortIcon = k => {
    const isActive = sortKey === k;
    return (
      <svg
        className={`ml-1 inline-block h-2.5 w-2.5 transition-all ${isActive && sortOrder === 'asc' ? 'rotate-180' : ''} ${isActive ? 'text-primary opacity-100' : 'opacity-20'}`}
        viewBox='0 0 10 10'
      >
        <path d='M5 10L0 0L10 0L5 10Z' fill='currentColor' />
      </svg>
    );
  };

  // Keep the name column flexible because pinning and compare badges both live
  // inside that cell instead of adding separate narrow columns.
  const showCompareSelection = false;
  const {
    widthCompare,
    widthName,
    widthSource,
    widthDate,
    widthProfile,
    widthAction,
    columnCount,
  } = getLibraryColumnLayout(isShot, showCompareSelection);
  const hasCompareBadges = items.some(item => Boolean(getCompareBadgeNumber?.(item)));
  const stickyHeaderCellClass = 'relative z-20 bg-base-200';

  return (
    <div
      className='bg-base-100/30 border-base-content/5 relative flex h-full flex-col rounded-lg border'
      style={sectionHeight ? { height: sectionHeight } : undefined}
    >
      {/* Toolbar */}
      <div className='border-base-content/5 space-y-3 border-b p-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-base-content flex items-center gap-2 text-base font-bold'>
            {title}{' '}
            <span className='bg-base-content/10 rounded-full px-1.5 py-0.5 text-[10px] font-normal'>
              {items.length}
            </span>
          </h3>
          <div className='flex gap-2'>
            <button
              onClick={onExportAll}
              className={getAnalyzerIconButtonClasses({
                tone: 'subtle',
                className: 'h-7 w-7 p-1.5',
              })}
              title='Export All'
            >
              <FontAwesomeIcon icon={faFileExport} size='sm' />
            </button>
            <button
              onClick={onDeleteAll}
              className={getAnalyzerIconButtonClasses({
                tone: 'error',
                className: 'h-7 w-7 p-1.5',
              })}
              title='Delete All'
            >
              <FontAwesomeIcon icon={faTrashCan} size='sm' />
            </button>
          </div>
        </div>
        <div className='flex gap-2'>
          <input
            type='text'
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchValue}
            onInput={e => onSearchChange(e.target.value)}
            className='bg-base-100/50 border-base-content/10 focus:border-primary h-9 flex-1 rounded border pl-3 text-sm outline-none'
          />
          <select
            value={`${sortKey}-${sortOrder}`}
            onChange={e => {
              const [k, o] = e.target.value.split('-');
              onSortChange(k, o);
            }}
            className='bg-base-100/50 border-base-content/10 hover:bg-base-content/5 hover:border-base-content/20 h-9 cursor-pointer rounded border px-2 text-xs transition-colors outline-none'
          >
            {isShot && <option value='shotDate-desc'>Date (New)</option>}
            {isShot && <option value='shotDate-asc'>Date (Old)</option>}
            <option value='name-asc'>Name (A-Z)</option>
            <option value='name-desc'>Name (Z-A)</option>
            {isShot && <option value='data.rating-desc'>Rating (High)</option>}
            {isShot && <option value='data.rating-asc'>Rating (Low)</option>}
            {isShot && <option value='duration-desc'>Length (Long)</option>}
            {isShot && <option value='duration-asc'>Length (Short)</option>}
          </select>
        </div>
      </div>

      <div
        className='scrollbar-thin relative h-96 overflow-y-auto px-2 lg:h-auto lg:min-h-0 lg:flex-1'
        style={{ scrollbarGutter: 'stable' }}
      >
        {isLoading && (
          <div className='bg-base-100/50 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[1px]'>
            <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary text-3xl' />
          </div>
        )}

        <table className='relative w-full border-separate border-spacing-0'>
          <thead className='sticky top-0 z-20 text-[10px] font-bold tracking-wide'>
            <tr>
              {showCompareSelection && (
                <th
                  className={`${stickyHeaderCellClass} px-2 py-3 text-center`}
                  style={{ width: widthCompare }}
                >
                  Cmp
                </th>
              )}
              <th className={`${stickyHeaderCellClass} p-0 text-left`} style={{ width: widthName }}>
                <div className='grid h-full w-full grid-cols-[minmax(0,1fr)_auto] items-stretch'>
                  <button
                    type='button'
                    className={getAnalyzerSurfaceTriggerClasses({
                      className:
                        'flex h-full w-full min-w-0 cursor-pointer items-center gap-1 px-3 py-3 text-left text-[10px] font-bold tracking-wide',
                    })}
                    onClick={() => onSortChange('name')}
                  >
                    <span className='truncate'>Name</span>
                    {getSortIcon('name')}
                  </button>
                  {onPinnedFirstToggle ? (
                    <button
                      type='button'
                      className={getAnalyzerIconButtonClasses({
                        tone: pinnedFirstEnabled ? 'primary' : 'subtle',
                        className: `mr-3 h-full min-h-full w-5 shrink-0 justify-self-end rounded-none bg-transparent p-0 text-[11px] ${
                          pinnedFirstEnabled ? 'text-primary hover:text-primary' : ''
                        }`,
                      })}
                      onClick={event => {
                        event.stopPropagation();
                        // Header pinning is a view-level promotion toggle; it
                        // does not mutate the pinned items themselves.
                        onPinnedFirstToggle();
                      }}
                      aria-label={`Toggle pinned ${isShot ? 'shots' : 'profiles'} first`}
                      title={`Toggle pinned ${isShot ? 'shots' : 'profiles'} first`}
                    >
                      <FontAwesomeIcon icon={faThumbtack} />
                    </button>
                  ) : null}
                </div>
              </th>
              <th
                className={`${stickyHeaderCellClass} p-0 text-center`}
                style={{ width: widthSource }}
              >
                <details className='dropdown block h-full w-full'>
                  <summary
                    className={getAnalyzerSurfaceTriggerClasses({
                      className:
                        'flex h-full w-full cursor-pointer list-none items-center justify-center gap-1 px-1 py-3 text-[10px] font-bold outline-none [&::-webkit-details-marker]:hidden',
                    })}
                    aria-label='Filter library source'
                    title='Filter library source'
                  >
                    {renderLibrarySourceHeaderContent(sourceFilter)}
                    <FontAwesomeIcon icon={faChevronDown} className='text-[9px] opacity-60' />
                  </summary>

                  <div className='dropdown-content bg-base-100/95 border-base-content/10 z-[65] mt-2 w-28 rounded-xl border p-1.5 shadow-xl backdrop-blur-md'>
                    <div className='grid gap-1'>
                      {SOURCE_FILTER_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type='button'
                          className={getAnalyzerSurfaceTriggerClasses({
                            className: `flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-bold ${
                              sourceFilter === option.value
                                ? 'bg-base-content/6 text-base-content'
                                : 'text-base-content/70'
                            }`,
                          })}
                          onClick={event => {
                            onSourceFilterChange(option.value);
                            closeParentDetails(event.currentTarget);
                          }}
                        >
                          {renderLibrarySourceOptionContent(option.value)}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </th>
              {isShot && (
                <th
                  className={`${stickyHeaderCellClass} p-0 text-left`}
                  style={{ width: widthDate }}
                >
                  <button
                    type='button'
                    className={getAnalyzerSurfaceTriggerClasses({
                      className:
                        'flex h-full w-full cursor-pointer items-center gap-1 px-3 py-3 text-left text-[10px] font-bold tracking-wide',
                    })}
                    onClick={() => onSortChange('shotDate')}
                  >
                    <span>Date</span>
                    {getSortIcon('shotDate')}
                  </button>
                </th>
              )}
              {isShot && (
                <th
                  className={`${stickyHeaderCellClass} px-3 py-3 text-left`}
                  style={{ width: widthProfile }}
                >
                  Profile
                </th>
              )}
              <th
                className={`${stickyHeaderCellClass} px-2 py-3 text-right`}
                style={{ width: widthAction }}
              />
            </tr>
          </thead>
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
                  onDelete={onDelete}
                  isPinned={Boolean(getPinStatus?.(item))}
                  pinDisabledReason={getPinDisabledReason?.(item) || ''}
                  onPinToggle={onPinToggle}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
