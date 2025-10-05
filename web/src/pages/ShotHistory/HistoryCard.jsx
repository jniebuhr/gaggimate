import Card from '../../components/Card.jsx';
import { useCallback, useState } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import ShotNotesCard from './ShotNotesCard.jsx';


function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function HistoryCard({ shot, onDelete, onLoad, onNotesChanged }) {
  const [shotNotes, setShotNotes] = useState(shot.notes || null);
  const [expanded, setExpanded] = useState(false);

  const date = new Date(shot.timestamp * 1000);

  const onExport = useCallback(() => {
    if (!shot.loaded) return; // Only export loaded data
    const exportData = { ...shot, notes: shotNotes };
    if (Array.isArray(exportData.samples)) {
      exportData.samples = exportData.samples.map(s => ({
        t: s.t,
        tt: round2(s.tt),
        ct: round2(s.ct),
        tp: round2(s.tp),
        cp: round2(s.cp),
        fl: round2(s.fl),
        tf: round2(s.tf),
        pf: round2(s.pf),
        vf: round2(s.vf),
        v: round2(s.v),
        ev: round2(s.ev),
        pr: round2(s.pr),
      }));
    }
    exportData.volume = round2(exportData.volume);
    // duration left as integer ms
    downloadJson(exportData, 'shot-' + shot.id + '.json');
  }, [shot, shotNotes]);

  const handleNotesLoaded = useCallback((notes) => {
    setShotNotes(notes);
  }, []);

  const handleNotesUpdate = useCallback((notes) => {
    setShotNotes(notes);
    // Notify parent that notes changed (so it can reload the index)
    if (onNotesChanged) onNotesChanged();
  }, [onNotesChanged]);
  const profileTitle = shot.profile || 'Unknown Profile';
  const formattedDate =
    date.toLocaleDateString() +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card sm={12} className='[&>.card-body]:p-2'>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-row items-start gap-2'>
          <button
            className='p-2 border border-base-content/20 text-base-content/60 hover:text-base-content hover:bg-base-content/10 hover:border-base-content/40 rounded-md transition-all duration-200'
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next && !shot.loaded && onLoad) onLoad(shot.id);
            }}
            aria-label={expanded ? 'Collapse shot details' : 'Expand shot details'}
          >
            <FontAwesomeIcon 
              icon={expanded ? faMinus : faPlus} 
              className='w-3 h-3'
            />
          </button>

          <div className='flex-grow min-w-0'>
            {/* Header Row */}
            <div className='flex flex-row items-start justify-between gap-3 mb-1'>
              <div className='flex-grow min-w-0'>
                <h3 className='text-base font-semibold text-base-content truncate'>
                  {profileTitle}
                </h3>
                <p className='text-sm text-base-content/70'>
                  #{shot.id} • {formattedDate}
                </p>
              </div>

              <div className='flex flex-row items-center gap-2 shrink-0'>
                {shot.incomplete && (
                  <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'>
                    INCOMPLETE
                  </span>
                )}

                <div className='flex flex-row gap-1'>
                  <div
                    className='tooltip tooltip-left'
                    data-tip={shot.loaded ? 'Export' : 'Load first'}
                  >
                    <button
                      disabled={!shot.loaded}
                      onClick={onExport} // no wrapper needed
                      className='p-2 text-base-content/50 hover:text-info hover:bg-info/10 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      aria-label='Export shot data'
                    >
                      <FontAwesomeIcon icon={faFileExport} className='w-4 h-4' />
                    </button>
                  </div>
                  <div className='tooltip tooltip-left' data-tip='Delete'>
                    <button
                      onClick={() => onDelete(shot.id)}
                      className='p-2 text-base-content/50 hover:text-error hover:bg-error/10 rounded-md transition-colors'
                      aria-label='Delete shot'
                    >
                      <FontAwesomeIcon icon={faTrashCan} className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className='flex flex-row items-center gap-4 text-sm text-base-content/80 mb-1'>
              <div className='flex items-center gap-1'>
                <FontAwesomeIcon icon={faClock} className='w-4 h-4' />
                <span>{(shot.duration / 1000).toFixed(1)}s</span>
              </div>

              {shot.volume && shot.volume > 0 && (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faWeightScale} className='w-4 h-4' />
                  <span>{round2(shot.volume)}g</span>
                </div>
              )}

              {shot.rating && shot.rating > 0 ? (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faStar} className='w-4 h-4 text-yellow-500' />
                  <span className='font-medium'>{shot.rating}/5</span>
                </div>
              ) : (
                <div className='flex items-center gap-1 text-base-content/50'>
                  <FontAwesomeIcon icon={faStar} className='w-4 h-4' />
                  <span>Not rated</span>
                </div>
              )}
            </div>

            {expanded && (
              <div className='mt-4 pt-4 border-t border-base-content/20'>
                {!shot.loaded && (
                  <div className='flex items-center justify-center py-8'>
                    <span className='text-sm text-base-content/70'>Loading shot data...</span>
                  </div>
                )}
                {shot.loaded && <HistoryChart shot={shot} />}
                {shot.loaded && (
                  <ShotNotesCard
                    shot={shot}
                    onNotesLoaded={handleNotesLoaded}
                    onNotesUpdate={handleNotesUpdate}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
