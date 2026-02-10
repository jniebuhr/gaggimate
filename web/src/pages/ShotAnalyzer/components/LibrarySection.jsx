/**
 * LibrarySection.jsx
 * * Fixed: Added scrollbar-gutter to prevent scrollbar from overlapping action icons.
 * * Fixed: Adjusted column layout for better symmetry.
 */

import { LibraryRow } from './LibraryRow';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';

export function LibrarySection({
    title, items, isShot, searchValue, sortKey, sortOrder, sourceFilter,
    onSearchChange, onSortChange, onSourceFilterChange, onLoad, 
    onExport, onDelete, onExportAll, onDeleteAll, getMatchStatus
}) {
    const getSortIcon = (k) => {
        const isActive = sortKey === k;
        return (
            <svg className={`inline-block w-2.5 h-2.5 ml-1 transition-all ${isActive && sortOrder === 'asc' ? 'rotate-180' : ''} ${isActive ? 'opacity-100 text-primary' : 'opacity-20'}`} viewBox="0 0 10 10">
                <path d="M5 10L0 0L10 0L5 10Z" fill="currentColor" />
            </svg>
        );
    };

    // Widths adjusted for better naming room and alignment
    const widthName = isShot ? "30%" : "55%";
    const widthSource = "10%";
    const widthDate = isShot ? "25%" : "0%"; 
    const widthProfile = isShot ? "25%" : "0%";
    const widthAction = "10%";

    return (
        <div className="flex flex-col h-full rounded-lg bg-base-100/30 border border-base-content/5">
            {/* Toolbar */}
            <div className="p-3 border-b border-base-content/5 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                        {title} <span className="text-[10px] font-normal px-1.5 py-0.5 bg-base-content/10 rounded-full">{items.length}</span>
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={onExportAll} className="p-1.5 text-base-content/50 hover:text-primary transition-colors" title="Export All"><FontAwesomeIcon icon={faFileExport} size="sm" /></button>
                        <button onClick={onDeleteAll} className="p-1.5 text-base-content/50 hover:text-error transition-colors" title="Delete All"><FontAwesomeIcon icon={faTrashCan} size="sm" /></button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder={`Search ${title.toLowerCase()}...`} value={searchValue} onInput={(e) => onSearchChange(e.target.value)} className="flex-1 h-9 pl-3 text-sm bg-base-100/50 border border-base-content/10 rounded outline-none focus:border-primary" />
                    <select value={`${sortKey}-${sortOrder}`} onChange={(e) => { const [k, o] = e.target.value.split('-'); onSortChange(k, o); }} className="h-9 px-2 text-xs bg-base-100/50 border border-base-content/10 rounded outline-none cursor-pointer">
                        {isShot && <option value="shotDate-desc">Date (New)</option>}
                        {isShot && <option value="shotDate-asc">Date (Old)</option>}
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        {isShot && <option value="data.rating-desc">Rating (High)</option>}
                        {isShot && <option value="data.rating-asc">Rating (Low)</option>}
                        {isShot && <option value="duration-desc">Length (Long)</option>}
                        {isShot && <option value="duration-asc">Length (Short)</option>}
                    </select>
                </div>
            </div>

            {/* Scrollable Container with Gutter Stability */}
            <div 
                className="flex-1 overflow-y-auto h-96 scrollbar-thin" 
                style={{ scrollbarGutter: 'stable' }}
            >
                <table className="w-full border-separate border-spacing-y-1 relative">
                    <thead className="sticky top-0 z-10 bg-base-200/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-3 py-3 text-left cursor-pointer hover:text-primary" style={{ width: widthName }} onClick={() => onSortChange('name')}>Name {getSortIcon('name')}</th>
                            <th className="px-1 py-3 text-center" style={{ width: widthSource }}>
                                <select value={sourceFilter} onChange={(e) => onSourceFilterChange(e.target.value)} className="bg-transparent border-none p-0 text-[10px] font-bold cursor-pointer outline-none">
                                    <option value="all">SRC</option><option value="gaggimate">GM</option><option value="browser">WEB</option>
                                </select>
                            </th>
                            {isShot && <th className="px-3 py-3 text-left cursor-pointer hover:text-primary" style={{ width: widthDate }} onClick={() => onSortChange('shotDate')}>Date {getSortIcon('shotDate')}</th>}
                            {isShot && <th className="px-3 py-3 text-left" style={{ width: widthProfile }}>Profile</th>}
                            <th className="px-2 py-3 text-right" style={{ width: widthAction }}></th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {items.map((item) => (
                            <LibraryRow key={item.id || item.name} item={item} isShot={isShot} isMatch={getMatchStatus(item)} onLoad={onLoad} onExport={onExport} onDelete={onDelete} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}