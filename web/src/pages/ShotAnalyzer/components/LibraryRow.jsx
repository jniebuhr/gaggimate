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
import { cleanName, formatTimestamp } from '../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../Statistics/utils/statisticsRoute';
import { SourceMarker } from './SourceMarker';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';

const ACTIVE_ROW_CLASSES = 'bg-primary/20 border-2 border-primary/60 shadow-md';
const COMPARE_PENDING_ROW_CLASSES = 'bg-primary/12 border border-primary/24 opacity-75 shadow-sm';
const COMPARE_ROW_CLASSES = 'bg-primary/16 border border-primary/42 shadow-sm';
const MATCH_ROW_CLASSES = 'bg-primary/8 border border-primary/24 shadow-sm';

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
  const itemName = item.name || item.label || 'Unknown';
  const displayName = isShot
    ? item.source === 'gaggimate'
      ? `#${item.id || itemName}`
      : cleanName(item.name || item.storageKey || item.id || itemName)
    : itemName.replace(/\.json$/i, '');

  // Format Date & Time
  const dateStr = formatTimestamp(item.timestamp || item.shotDate);
  const [datePart, timePart] = dateStr.includes(',') ? dateStr.split(', ') : [dateStr, ''];
  const profileStatsHref = !isShot
    ? buildStatisticsProfileHref({
        source: item.source,
        profileName: item.label || item.name || '',
      })
    : null;

  const isCompareHighlight = isCompareSelected || isCompareRelated;
  const statisticsIcon = compareMode ? faChartArea : faChartSimple;

  const rowClasses = isActive
    ? ACTIVE_ROW_CLASSES
    : isComparePending
      ? COMPARE_PENDING_ROW_CLASSES
      : isCompareHighlight
        ? COMPARE_ROW_CLASSES
        : isMatch
          ? MATCH_ROW_CLASSES
          : 'hover:bg-base-content/5 border border-transparent';

  const nameClasses = isActive
    ? 'text-primary font-bold'
    : isCompareHighlight
      ? 'text-primary font-semibold opacity-95'
      : isMatch
        ? 'text-primary font-medium opacity-70'
        : 'font-medium';

  return (
    <tr
      className={`group relative isolate cursor-pointer rounded-md transition-all duration-200 ${
        compareBadgeNumber ? 'z-[1]' : 'z-0'
      } ${rowClasses}`}
      onClick={event => onLoad(event)}
    >
      {showCompareSelection && (
        <td className='px-2 py-2 text-center first:rounded-l-md'>
          <div className='flex items-center justify-center' onClick={e => e.stopPropagation()}>
            {isComparePending ? (
              <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary text-xs' />
            ) : (
              <input
                type='checkbox'
                checked={isCompareSelected}
                disabled={isCompareSelectionDisabled}
                title={isCompareReference ? 'Reference shot' : 'Compare shot'}
                aria-label={isCompareReference ? 'Reference shot' : 'Compare shot'}
                onChange={event => onCompareToggle?.(event.currentTarget.checked)}
                className='checkbox checkbox-xs border-base-content/20 rounded-sm'
              />
            )}
          </div>
        </td>
      )}
      <td
        className={`relative overflow-visible px-3 py-2 ${
          showCompareSelection ? '' : 'first:rounded-l-md'
        }`}
      >
        {compareBadgeNumber ? (
          <span
            className={`ring-base-100 pointer-events-none absolute -top-1.5 -left-1 z-[1] inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold shadow-md ring-2 ${
              compareBadgeNumber === 1
                ? 'bg-primary text-primary-content'
                : 'bg-primary/70 text-primary-content'
            }`}
          >
            {compareBadgeNumber}
          </span>
        ) : null}
        <div className='flex items-center gap-1.5'>
          {compareBadgeNumber ? (
            <span className='sr-only'>Compare slot {compareBadgeNumber}</span>
          ) : null}
          <span className={`block min-w-0 flex-1 truncate text-sm ${nameClasses}`}>
            {displayName}
          </span>
          {onPinToggle ? (
            <button
              type='button'
              aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${displayName}`}
              aria-disabled={!isPinned && !!pinDisabledReason}
              title={
                pinDisabledReason || `${isPinned ? 'Unpin' : 'Pin'} ${isShot ? 'shot' : 'profile'}`
              }
              onClick={event => {
                event.stopPropagation();
                if (!isPinned && pinDisabledReason) return;
                // Pinning is intentionally scoped outside the row click so the
                // current library selection does not change while curating pins.
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
          ) : null}
        </div>
      </td>
      <td className='px-2 py-2 text-center'>
        <SourceMarker source={item.source} variant='library' />
      </td>
      {isShot && (
        <td className='px-3 py-2 whitespace-nowrap'>
          <div className='flex flex-col leading-tight'>
            <span className='text-xs font-medium'>{datePart}</span>
            <span className='text-[10px] opacity-40'>{timePart}</span>
          </div>
        </td>
      )}
      {isShot && (
        <td className='px-3 py-2'>
          <span className='block max-w-[100px] truncate text-xs opacity-50'>
            {item.profileName || item.profile || '-'}
          </span>
        </td>
      )}
      {/* Action cell with extra right padding for scrollbar clearance */}
      <td className='px-4 py-2 text-right last:rounded-r-md'>
        <div className='flex justify-end gap-2' onClick={e => e.stopPropagation()}>
          {!isShot && (
            <a
              href={profileStatsHref || '/statistics'}
              onClick={event => {
                event.stopPropagation();
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
            onClick={() => onExport(item)}
            className={getAnalyzerIconButtonClasses({
              tone: 'subtle',
              className: 'h-6 w-6',
            })}
          >
            <FontAwesomeIcon icon={faFileExport} size='xs' />
          </button>
          <button
            onClick={() => onDelete(item)}
            className={getAnalyzerIconButtonClasses({
              tone: 'error',
              className: 'h-6 w-6',
            })}
          >
            <FontAwesomeIcon icon={faTrashCan} size='xs' />
          </button>
        </div>
      </td>
    </tr>
  );
}
