/**
 * LibraryRow.jsx
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { cleanName, formatTimestamp, getProfileDisplayLabel } from '../../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../../Statistics/utils/statisticsRoute';
import { SourceMarker } from '../SourceMarker';
import { getAnalyzerIconButtonClasses } from '../analyzerControlStyles';
import { LibraryActionsMenu } from './LibraryActionsMenu';

const ACTIVE_ROW_CLASSES = 'bg-primary/18';
const COMPARE_PENDING_ROW_CLASSES = 'bg-primary/10 opacity-75';
const COMPARE_ROW_CLASSES = 'bg-primary/14';
const MATCH_ROW_CLASSES = 'bg-primary/7';

function getLibraryDisplayName(item, itemName, isShot) {
  if (!isShot) return itemName.replace(/\.json$/i, '');
  if (item.source === 'gaggimate') return `#${item.id || itemName}`;
  return cleanName(item.name || item.storageKey || item.id || itemName);
}

function getLibraryRowClasses({ isActive, isComparePending, isCompareHighlight, isMatch }) {
  if (isActive) return ACTIVE_ROW_CLASSES;
  if (isComparePending) return COMPARE_PENDING_ROW_CLASSES;
  if (isCompareHighlight) return COMPARE_ROW_CLASSES;
  if (isMatch) return MATCH_ROW_CLASSES;
  return 'hover:bg-base-content/5';
}

function getLibraryNameClasses({ isActive, isCompareHighlight, isMatch }) {
  if (isActive) return 'text-primary font-medium';
  if (isCompareHighlight) return 'text-primary font-medium opacity-95';
  if (isMatch) return 'text-primary font-normal opacity-75';
  return 'font-normal';
}

function getCompareBadgeClasses(compareBadgeNumber) {
  return compareBadgeNumber === 1
    ? 'bg-primary text-primary-content'
    : 'bg-primary/70 text-primary-content';
}

function stopRowClick(event) {
  event.stopPropagation();
}

function splitLibraryDateTime(value) {
  return value.includes(', ') ? value.split(', ') : [value, ''];
}

function CompareSelectionControl({
  isComparePending,
  isCompareSelected,
  isCompareSelectionDisabled,
  isCompareReference,
  onCompareToggle,
}) {
  return (
    <span className='flex h-6 w-6 shrink-0 items-center justify-center'>
      {isComparePending ? (
        <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary text-xs' />
      ) : (
        <input
          type='checkbox'
          checked={isCompareSelected}
          disabled={isCompareSelectionDisabled}
          title={isCompareReference ? 'Reference shot' : 'Compare shot'}
          aria-label={isCompareReference ? 'Reference shot' : 'Compare shot'}
          onClick={event => event.stopPropagation()}
          onChange={event => onCompareToggle?.(event.currentTarget.checked)}
          className='checkbox checkbox-xs border-base-content/20 rounded-sm'
        />
      )}
    </span>
  );
}

function LibraryCompareBadge({ compareBadgeNumber }) {
  if (!compareBadgeNumber) return null;

  return (
    <span
      className={`ring-base-100 pointer-events-none absolute -top-1.5 -left-1 z-[1] inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold shadow-md ring-2 ${getCompareBadgeClasses(compareBadgeNumber)}`}
    >
      {compareBadgeNumber}
    </span>
  );
}

function LibraryPinButton({ item, isPinned, pinDisabledReason, onPinToggle, displayName, isShot }) {
  if (!onPinToggle) return null;

  return (
    <button
      type='button'
      aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${displayName}`}
      aria-disabled={!isPinned && !!pinDisabledReason}
      title={pinDisabledReason || `${isPinned ? 'Unpin' : 'Pin'} ${isShot ? 'shot' : 'profile'}`}
      onClick={event => {
        stopRowClick(event);
        if (!isPinned && pinDisabledReason) return;
        onPinToggle(item);
      }}
      className={getAnalyzerIconButtonClasses({
        tone: isPinned ? 'primary' : 'subtle',
        className: `library-row-grid__pin-button h-5 w-5 shrink-0 bg-transparent p-0 text-xs ${
          isPinned ? 'text-primary hover:text-primary' : ''
        } ${!isPinned && pinDisabledReason ? 'cursor-not-allowed opacity-35' : ''}`,
      })}
    >
      <FontAwesomeIcon icon={faThumbtack} />
    </button>
  );
}

function LibraryActionsCell({
  isShot,
  item,
  profileStatsHref,
  onShowStats,
  onExport,
  onDelete,
  statisticsIcon,
}) {
  const actions = [
    ...(!isShot
      ? [
          {
            label: 'Profile Statistics',
            icon: statisticsIcon,
            tone: 'success',
            href: profileStatsHref || '/statistics',
            onSelect: () => onShowStats?.(item),
          },
        ]
      : []),
    {
      label: 'Export',
      icon: faFileExport,
      onSelect: () => onExport(item),
    },
    {
      label: 'Delete',
      icon: faTrashCan,
      tone: 'error',
      onSelect: () => onDelete(item),
    },
  ];

  return (
    <LibraryActionsMenu
      actions={actions}
      ariaLabel={`Open ${isShot ? 'shot' : 'profile'} actions menu`}
      buttonClassName='h-6 w-6'
      placement='top'
    />
  );
}

export function LibraryRow({
  item,
  compareBadgeNumber = null,
  isMatch,
  isCompareRelated = false,
  isActive,
  isShot,
  showCompareSelection = false,
  isCompareSelected = false,
  isComparePending = false,
  isCompareReference = false,
  isCompareSelectionDisabled = false,
  compareMode = false,
  onCompareToggle,
  onShowStats,
  onLoad,
  onExport,
  onDelete,
  isPinned = false,
  pinDisabledReason = '',
  onPinToggle,
  columnCount = 1,
}) {
  const itemName = isShot ? item.name || item.label || 'Unknown' : getProfileDisplayLabel(item);
  const displayName = getLibraryDisplayName(item, itemName, isShot);

  // Format Date & Time
  const dateStr = formatTimestamp(item.timestamp || item.shotDate);
  const [datePart, timePart] = splitLibraryDateTime(dateStr);
  const profileStatsHref = isShot
    ? null
    : buildStatisticsProfileHref({
        source: item.source,
        profileName: getProfileDisplayLabel(item, ''),
      });

  const isCompareHighlight = isCompareSelected || isCompareRelated;
  const statisticsIcon = compareMode ? faChartArea : faChartSimple;

  const rowClasses = getLibraryRowClasses({
    isActive,
    isComparePending,
    isCompareHighlight,
    isMatch,
  });
  const nameClasses = getLibraryNameClasses({
    isActive,
    isCompareHighlight,
    isMatch,
  });

  return (
    <tr
      className={`group relative isolate cursor-pointer transition-all duration-200 ${
        compareBadgeNumber ? 'z-[1]' : 'z-0'
      }`}
      onClick={onLoad}
    >
      <td colSpan={columnCount} className='px-0 py-0.5'>
        <div
          className={`library-row-grid library-row-grid--${isShot ? 'shot' : 'profile'} relative rounded-xl px-3 py-2 transition-all duration-200 ${rowClasses}`}
        >
          <LibraryCompareBadge compareBadgeNumber={compareBadgeNumber} />
          {showCompareSelection ? (
            <CompareSelectionControl
              isComparePending={isComparePending}
              isCompareSelected={isCompareSelected}
              isCompareSelectionDisabled={isCompareSelectionDisabled}
              isCompareReference={isCompareReference}
              onCompareToggle={onCompareToggle}
            />
          ) : null}
          <div className='library-row-grid__name flex min-w-0 items-center gap-1.5'>
            <span
              className={`library-row-grid__name-text block min-w-0 flex-1 text-sm ${nameClasses}`}
            >
              {displayName}
            </span>
          </div>
          <div className='library-row-grid__pin flex justify-center'>
            <LibraryPinButton
              item={item}
              isPinned={isPinned}
              pinDisabledReason={pinDisabledReason}
              onPinToggle={onPinToggle}
              displayName={displayName}
              isShot={isShot}
            />
          </div>
          <div className='library-row-grid__source flex justify-center'>
            <SourceMarker source={item.source} variant='library' />
          </div>
          {isShot ? (
            <div className='library-row-grid__date min-w-0 leading-tight'>
              <span className='block truncate text-xs font-medium'>{datePart}</span>
              <span className='block truncate text-xs opacity-40'>{timePart}</span>
            </div>
          ) : null}
          {isShot ? (
            <div className='library-row-grid__profile text-base-content/60 min-w-0 text-sm font-normal'>
              {item.profileName || item.profile || '-'}
            </div>
          ) : null}
          <div className='library-row-grid__actions flex justify-end'>
            <LibraryActionsCell
              isShot={isShot}
              item={item}
              profileStatsHref={profileStatsHref}
              onShowStats={onShowStats}
              onExport={onExport}
              onDelete={onDelete}
              statisticsIcon={statisticsIcon}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
