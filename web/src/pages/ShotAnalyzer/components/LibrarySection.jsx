/**
 * LibrarySection.jsx
 */

import { LibraryRow } from './LibraryRow';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import {
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
} from './analyzerControlStyles';

function getLibraryItemKey(item, isShot) {
  if (!item) return 'unknown-item';

  if (isShot) {
    if (item.source === 'gaggimate') return `gaggimate-shot:${String(item.id || '')}`;
    return `browser-shot:${String(item.storageKey || item.name || item.id || '')}`;
  }

  if (item.source === 'gaggimate') {
    return `gaggimate-profile:${String(item.profileId || item.id || item.name || item.label || '')}`;
  }

  return `browser-profile:${String(item.name || item.label || item.id || '')}`;
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
  getMatchStatus,
  getActiveStatus,
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

  // Widths adjusted for better naming room and alignment
  const widthName = isShot ? '30%' : '55%';
  const widthSource = '10%';
  const widthDate = isShot ? '25%' : '0%';
  const widthProfile = isShot ? '25%' : '0%';
  const widthAction = '10%';

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

      {/* Scrollable Container with Gutter Stability */}
      <div
        className='scrollbar-thin relative h-96 overflow-y-auto lg:h-auto lg:min-h-0 lg:flex-1'
        style={{ scrollbarGutter: 'stable' }}
      >
        {/* LOADING OVERLAY for Sort/Search */}
        {isLoading && (
          <div className='bg-base-100/50 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[1px]'>
            <FontAwesomeIcon icon={faCircleNotch} spin className='text-primary text-3xl' />
          </div>
        )}

        <table className='relative w-full border-separate border-spacing-0'>
          <thead className='bg-base-200 sticky top-0 z-10 text-[10px] font-bold tracking-wider uppercase'>
            <tr>
              <th
                className={getAnalyzerSurfaceTriggerClasses({
                  className: 'cursor-pointer px-3 py-3 text-left',
                })}
                style={{ width: widthName }}
                onClick={() => onSortChange('name')}
              >
                Name {getSortIcon('name')}
              </th>
              <th className='px-1 py-3 text-center' style={{ width: widthSource }}>
                <select
                  value={sourceFilter}
                  onChange={e => onSourceFilterChange(e.target.value)}
                  className={getAnalyzerSurfaceTriggerClasses({
                    className:
                      'cursor-pointer border-none bg-transparent px-1.5 py-1 text-[10px] font-bold outline-none',
                  })}
                >
                  <option value='all'>SRC</option>
                  <option value='gaggimate'>GM</option>
                  <option value='browser'>WEB</option>
                </select>
              </th>
              {isShot && (
                <th
                  className={getAnalyzerSurfaceTriggerClasses({
                    className: 'cursor-pointer px-3 py-3 text-left',
                  })}
                  style={{ width: widthDate }}
                  onClick={() => onSortChange('shotDate')}
                >
                  Date {getSortIcon('shotDate')}
                </th>
              )}
              {isShot && (
                <th className='px-3 py-3 text-left' style={{ width: widthProfile }}>
                  Profile
                </th>
              )}
              <th className='px-2 py-3 text-right' style={{ width: widthAction }} />
            </tr>
          </thead>
          <tbody className='text-sm'>
            {items.map(item => (
              <LibraryRow
                key={getLibraryItemKey(item, isShot)}
                item={item}
                isShot={isShot}
                isMatch={getMatchStatus(item)}
                isActive={getActiveStatus ? getActiveStatus(item) : false}
                onLoad={onLoad}
                onExport={onExport}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
