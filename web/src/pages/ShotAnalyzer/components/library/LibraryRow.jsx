/**
 * LibraryRow.jsx
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLingui } from '@lingui/react/macro';
import { faChartArea } from '@fortawesome/free-solid-svg-icons/faChartArea';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons/faGaugeHigh';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { formatTimestamp, getProfileDisplayLabel } from '../../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../../Statistics/utils/statisticsRoute';
import { getAnalyzerIconButtonClasses } from '../analyzerControlStyles';
import { LibraryActionsMenu } from './LibraryActionsMenu';

const ACTIVE_ROW_CLASSES = 'bg-primary/18';
const COMPARE_PENDING_ROW_CLASSES = 'bg-primary/10 opacity-75';
const COMPARE_ROW_CLASSES = 'bg-primary/14';
const MATCH_ROW_CLASSES = 'bg-primary/7';

function getLibraryDisplayName(item, itemName, isShot) {
  if (!isShot) return itemName.replace(/\.json$/i, '');
  return `#${item.id || itemName}`;
}

function getLibraryRowClasses({ isActive, isComparePending, isCompareHighlight, isMatch, isShot }) {
  if (isActive) return ACTIVE_ROW_CLASSES;
  if (isComparePending) return COMPARE_PENDING_ROW_CLASSES;
  if (isCompareHighlight) return COMPARE_ROW_CLASSES;
  if (isMatch) return MATCH_ROW_CLASSES;
  return isShot ? 'bg-base-100 hover:bg-base-200' : 'hover:bg-base-content/5';
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
  const { t } = useLingui();
  const compareLabel = isCompareReference ? t`Reference shot` : t`Compare shot`;
  return (
    <span className='flex h-6 w-6 shrink-0 items-center justify-center'>
      {isComparePending ? (
        <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary text-xs' />
      ) : (
        <input
          type='checkbox'
          checked={isCompareSelected}
          disabled={isCompareSelectionDisabled}
          title={compareLabel}
          aria-label={compareLabel}
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

export function LibraryPinButton({
  item,
  isPinned,
  pinDisabledReason,
  onPinToggle,
  displayName,
  isShot,
  disabled = false,
  className = 'h-5 w-5 text-xs',
}) {
  const { t } = useLingui();
  if (!onPinToggle) return null;

  const pinAriaLabel = isPinned ? t`Unpin ${displayName}` : t`Pin ${displayName}`;
  let pinTitle;
  if (isShot) pinTitle = isPinned ? t`Unpin shot` : t`Pin shot`;
  else pinTitle = isPinned ? t`Unpin profile` : t`Pin profile`;

  return (
    <button
      type='button'
      aria-label={pinAriaLabel}
      disabled={disabled}
      aria-disabled={disabled || (!isPinned && !!pinDisabledReason)}
      title={pinDisabledReason || pinTitle}
      onClick={event => {
        stopRowClick(event);
        if (!isPinned && pinDisabledReason) return;
        onPinToggle(item);
      }}
      className={getAnalyzerIconButtonClasses({
        tone: isPinned ? 'primary' : 'subtle',
        className: `library-row-grid__pin-button shrink-0 bg-transparent p-0 ${className} ${
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
  onUpload,
  actionsDisabled,
  statisticsIcon,
}) {
  const { t } = useLingui();
  const actions = [
    ...(!isShot
      ? [
          {
            label: t`Profile Statistics`,
            icon: statisticsIcon,
            tone: 'success',
            href: profileStatsHref || '/statistics',
            onSelect: () => onShowStats?.(item),
          },
        ]
      : []),
    ...(!isShot
      ? [
          {
            label: t`Export`,
            icon: faFileExport,
            onSelect: () => onExport(item),
            disabled: actionsDisabled,
          },
        ]
      : []),
    {
      label: t`Delete`,
      icon: faTrashCan,
      tone: 'error',
      onSelect: () => onDelete(item),
      disabled: actionsDisabled,
    },
  ];

  return (
    <div className='flex items-center gap-1'>
      {isShot && onUpload && (
        <button
          type='button'
          className={getAnalyzerIconButtonClasses({
            tone: 'success',
            className: 'h-6 w-6 shrink-0 text-xs',
          })}
          title={t`Upload to Visualizer.coffee`}
          aria-label={t`Upload to Visualizer.coffee`}
          disabled={actionsDisabled}
          onClick={event => {
            stopRowClick(event);
            onUpload(item);
          }}
        >
          <FontAwesomeIcon icon={faUpload} />
        </button>
      )}
      {isShot && (
        <button
          type='button'
          className={getAnalyzerIconButtonClasses({ className: 'h-6 w-6 shrink-0 text-xs' })}
          title={t`Export`}
          aria-label={t`Export`}
          disabled={actionsDisabled}
          onClick={event => {
            stopRowClick(event);
            onExport(item);
          }}
        >
          <FontAwesomeIcon icon={faFileExport} />
        </button>
      )}
      <LibraryActionsMenu
        actions={actions}
        ariaLabel={isShot ? t`Open shot actions menu` : t`Open profile actions menu`}
        buttonClassName='h-6 w-6'
        placement='top'
      />
    </div>
  );
}

function LibraryShotMetrics({ item }) {
  const { t } = useLingui();
  return (
    <div className='library-row-grid__metrics flex flex-wrap items-center gap-x-4 gap-y-1 text-sm lg:text-base'>
      <span className='text-base-content/70 inline-flex items-center gap-1.5'>
        <FontAwesomeIcon icon={faClock} />
        {item.duration != null && Number.isFinite(Number(item.duration))
          ? `${(Number(item.duration) / 1000).toFixed(1)}s`
          : '–'}
      </span>
      <span className='text-base-content/70 inline-flex items-center gap-1.5'>
        <FontAwesomeIcon icon={faWeightScale} />
        {item.volume != null && Number.isFinite(Number(item.volume))
          ? `${Number(item.volume).toFixed(1)}g`
          : '–'}
      </span>
      <span
        className='text-base-content/70 inline-flex items-center gap-1.5'
        title={t`Peak Pressure`}
      >
        <FontAwesomeIcon icon={faGaugeHigh} />
        {item.maxPressure != null && Number.isFinite(Number(item.maxPressure))
          ? `${Number(item.maxPressure).toFixed(1)}bar`
          : '–'}
      </span>
      <span className='text-base-content/70 inline-flex items-center gap-1.5'>
        <FontAwesomeIcon
          icon={faStar}
          className={Number(item.rating) > 0 ? 'text-yellow-500' : undefined}
        />
        {Number(item.rating) > 0 ? `${item.rating}/5` : t`Not rated`}
      </span>
      {item.incomplete && <span className='text-warning'>{t`INCOMPLETE`}</span>}
    </div>
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
  onUpload,
  actionsDisabled,
  isPinned = false,
  pinDisabledReason = '',
  onPinToggle,
  columnCount = 1,
}) {
  const { t } = useLingui();
  const itemName = isShot ? item.name || item.label || t`Unknown` : getProfileDisplayLabel(item);
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
    isShot,
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
      <td colSpan={columnCount} className={`px-0 ${isShot ? 'py-1.5' : 'py-0.5'}`}>
        <div
          className={`library-row-grid library-row-grid--${isShot ? 'shot' : 'profile'} relative rounded-xl px-3 py-2 transition-all duration-200 ${isShot ? 'border-base-content/10 border' : ''} ${rowClasses}`}
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
              className={`library-row-grid__name-text block min-w-0 flex-1 ${isShot ? 'text-sm font-semibold lg:text-base' : 'text-sm'} ${nameClasses}`}
            >
              {isShot ? item.profileName || item.profile || t`Unknown Profile` : displayName}
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
          {isShot && (
            <div className='library-row-grid__date flex flex-wrap items-center gap-x-1.5 text-xs opacity-60 lg:text-sm'>
              <span>{displayName}</span>
              <span aria-hidden='true'>•</span>
              <span>
                {datePart}
                {timePart ? ` ${timePart}` : ''}
              </span>
            </div>
          )}
          {isShot && <LibraryShotMetrics item={item} />}
          <div className='library-row-grid__actions flex justify-end'>
            <LibraryActionsCell
              isShot={isShot}
              item={item}
              profileStatsHref={profileStatsHref}
              onShowStats={onShowStats}
              onExport={onExport}
              onDelete={onDelete}
              onUpload={onUpload}
              actionsDisabled={actionsDisabled}
              statisticsIcon={statisticsIcon}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
