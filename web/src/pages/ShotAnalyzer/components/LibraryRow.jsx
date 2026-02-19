/**
 * LibraryRow.jsx
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { formatTimestamp } from '../utils/analyzerUtils';

export function LibraryRow({ item, isMatch, isShot, onLoad, onExport, onDelete }) {
  const itemName = item.name || item.label || 'Unknown';
  const displayName = isShot ? `#${item.id || itemName}` : itemName.replace(/\.json$/i, '');

  // Format Date & Time
  const dateStr = formatTimestamp(item.timestamp || item.shotDate);
  const [datePart, timePart] = dateStr.includes(',') ? dateStr.split(', ') : [dateStr, ''];

  // Consistent full border highlighting
  const rowClasses = isMatch
    ? 'bg-primary/10 border border-primary/40 shadow-sm'
    : 'hover:bg-base-content/5 border border-transparent';

  return (
    <tr
      className={`group cursor-pointer rounded-md transition-all duration-200 ${rowClasses}`}
      onClick={() => onLoad(item)}
    >
      <td className='px-3 py-2 first:rounded-l-md'>
        <span
          className={`block truncate text-sm ${isMatch ? 'text-primary font-bold' : 'font-medium'}`}
        >
          {displayName}
        </span>
      </td>
      <td className='px-2 py-2 text-center'>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${item.source === 'gaggimate' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}
        >
          {item.source === 'gaggimate' ? 'GM' : 'WEB'}
        </span>
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
          <button
            onClick={() => onExport(item)}
            className='text-base-content/30 hover:text-primary transition-colors'
          >
            <FontAwesomeIcon icon={faFileExport} size='xs' />
          </button>
          <button
            onClick={() => onDelete(item)}
            className='text-base-content/30 hover:text-error transition-colors'
          >
            <FontAwesomeIcon icon={faTrashCan} size='xs' />
          </button>
        </div>
      </td>
    </tr>
  );
}
