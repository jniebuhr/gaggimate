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
import { cleanName, formatTimestamp, getProfileDisplayLabel } from '../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../Statistics/utils/statisticsRoute';
import { SourceMarker } from './SourceMarker';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';

const ACTIVE_ROW_CLASSES = 'bg-primary/20 border-2 border-primary/60 shadow-md';
const COMPARE_PENDING_ROW_CLASSES = 'bg-primary/12 border border-primary/24 opacity-75 shadow-sm';
const COMPARE_ROW_CLASSES = 'bg-primary/16 border border-primary/42 shadow-sm';
const MATCH_ROW_CLASSES = 'bg-primary/8 border border-primary/24 shadow-sm';

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
  return 'hover:bg-base-content/5 border border-transparent';
}

function getLibraryNameClasses({ isActive, isCompareHighlight, isMatch }) {
  if (isActive) return 'text-primary font-bold';
  if (isCompareHighlight) return 'text-primary font-semibold opacity-95';
  if (isMatch) return 'text-primary font-medium opacity-70';
  return 'font-medium';
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

function CompareSelectionCell({
  isComparePending,
  isCompareSelected,
  isCompareSelectionDisabled,
  isCompareReference,
  onCompareToggle,
}) {
  return (
    <td className='px-2 py-2 text-center first:rounded-l-md'>
      <span className='flex items-center justify-center'>
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
    </td>
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
        className: `h-5 w-5 shrink-0 bg-transparent p-0 text-[11px] ${
          isPinned ? 'text-primary hover:text-primary' : ''
        } ${!isPinned && pinDisabledReason ? 'cursor-not-allowed opacity-35' : ''}`,
      })}
    >
      <FontAwesomeIcon icon={faThumbtack} />
    </button>
  );
}

function LibraryNameCell({
  item,
  isShot,
  showCompareSelection,
  displayName,
  nameClasses,
  compareBadgeNumber,
  isPinned,
  pinDisabledReason,
  onPinToggle,
}) {
  return (
    <td
      className={`relative overflow-visible px-3 py-2 ${
        showCompareSelection ? '' : 'first:rounded-l-md'
      }`}
    >
      <LibraryCompareBadge compareBadgeNumber={compareBadgeNumber} />
      <div className='flex items-center gap-1.5'>
        {compareBadgeNumber ? (
          <span className='sr-only'>Compare slot {compareBadgeNumber}</span>
        ) : null}
        <span className={`block min-w-0 flex-1 truncate text-sm ${nameClasses}`}>
          {displayName}
        </span>
        <LibraryPinButton
          item={item}
          isPinned={isPinned}
          pinDisabledReason={pinDisabledReason}
          onPinToggle={onPinToggle}
          displayName={displayName}
          isShot={isShot}
        />
      </div>
    </td>
  );
}

function LibrarySourceCell({ source }) {
  return (
    <td className='px-2 py-2 text-center'>
      <SourceMarker source={source} variant='library' />
    </td>
  );
}

function LibraryDateCell({ datePart, timePart }) {
  return (
    <td className='px-3 py-2 whitespace-nowrap'>
      <div className='flex flex-col leading-tight'>
        <span className='text-xs font-medium'>{datePart}</span>
        <span className='text-[10px] opacity-40'>{timePart}</span>
      </div>
    </td>
  );
}

function LibraryProfileCell({ profileName }) {
  return (
    <td className='px-3 py-2'>
      <span className='block max-w-[100px] truncate text-xs opacity-50'>{profileName || '-'}</span>
    </td>
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
  return (
    <td className='px-4 py-2 text-right last:rounded-r-md'>
      <div className='flex justify-end gap-2'>
        {!isShot && (
          <a
            href={profileStatsHref || '/statistics'}
            onClick={event => {
              stopRowClick(event);
              onShowStats?.(item);
            }}
            className={getAnalyzerIconButtonClasses({
              tone: 'success',
              className: 'h-6 w-6',
            })}
            title='Profile statistics'
          >
            <FontAwesomeIcon icon={statisticsIcon} size='xs' />
          </a>
        )}
        <button
          type='button'
          onClick={event => {
            stopRowClick(event);
            onExport(item);
          }}
          className={getAnalyzerIconButtonClasses({
            tone: 'subtle',
            className: 'h-6 w-6',
          })}
        >
          <FontAwesomeIcon icon={faFileExport} size='xs' />
        </button>
        <button
          type='button'
          onClick={event => {
            stopRowClick(event);
            onDelete(item);
          }}
          className={getAnalyzerIconButtonClasses({
            tone: 'error',
            className: 'h-6 w-6',
          })}
        >
          <FontAwesomeIcon icon={faTrashCan} size='xs' />
        </button>
      </div>
    </td>
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
}) {
  const itemName = isShot ? item.name || item.label || 'Unknown' : getProfileDisplayLabel(item);
  const displayName = getLibraryDisplayName(item, itemName, isShot);

  // Format Date & Time
  const dateStr = formatTimestamp(item.timestamp || item.shotDate);
  const [datePart, timePart] = splitLibraryDateTime(dateStr);
  const profileStatsHref = !isShot
    ? buildStatisticsProfileHref({
        source: item.source,
        profileName: getProfileDisplayLabel(item, ''),
      })
    : null;

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
      className={`group relative isolate cursor-pointer rounded-md transition-all duration-200 ${
        compareBadgeNumber ? 'z-[1]' : 'z-0'
      } ${rowClasses}`}
      onClick={onLoad}
    >
      {showCompareSelection && (
        <CompareSelectionCell
          isComparePending={isComparePending}
          isCompareSelected={isCompareSelected}
          isCompareSelectionDisabled={isCompareSelectionDisabled}
          isCompareReference={isCompareReference}
          onCompareToggle={onCompareToggle}
        />
      )}
      <LibraryNameCell
        item={item}
        isShot={isShot}
        showCompareSelection={showCompareSelection}
        displayName={displayName}
        nameClasses={nameClasses}
        compareBadgeNumber={compareBadgeNumber}
        isPinned={isPinned}
        pinDisabledReason={pinDisabledReason}
        onPinToggle={onPinToggle}
      />
      <LibrarySourceCell source={item.source} />
      {isShot && <LibraryDateCell datePart={datePart} timePart={timePart} />}
      {isShot && <LibraryProfileCell profileName={item.profileName || item.profile} />}
      <LibraryActionsCell
        isShot={isShot}
        item={item}
        profileStatsHref={profileStatsHref}
        onShowStats={onShowStats}
        onExport={onExport}
        onDelete={onDelete}
        statisticsIcon={statisticsIcon}
      />
    </tr>
  );
}
