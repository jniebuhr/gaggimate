/**
 * LibraryRow.jsx
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { cleanName, formatTimestamp } from '../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../Statistics/utils/statisticsRoute';
import { SourceMarker } from './SourceMarker';
import { getAnalyzerIconButtonClasses } from './analyzerControlStyles';

export function LibraryRow({ item, isMatch, isActive, isShot, onLoad, onExport, onDelete }) {
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

  // Consistent full border highlighting
  const rowClasses = isActive
    ? 'bg-primary/20 border-2 border-primary/60 shadow-md'
    : isMatch
      ? 'bg-primary/10 border border-primary/40 shadow-sm'
      : 'hover:bg-base-content/5 border border-transparent';

  return (
    <tr
      className={`group cursor-pointer rounded-md transition-all duration-200 ${rowClasses}`}
      onClick={() => onLoad(item)}
    >
      <td className='px-3 py-2 first:rounded-l-md'>
        <span
          className={`block truncate text-sm ${isActive ? 'text-primary font-bold' : isMatch ? 'text-primary font-bold' : 'font-medium'}`}
        >
          {displayName}
        </span>
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
              className={getAnalyzerIconButtonClasses({
                tone: 'success',
                className: 'h-6 w-6',
              })}
              title='Profile statistics'
            >
              <FontAwesomeIcon icon={faChartSimple} size='xs' />
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
