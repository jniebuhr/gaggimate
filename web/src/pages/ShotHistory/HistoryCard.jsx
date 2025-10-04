import Card from '../../components/Card.jsx';
import { useCallback, useState } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import ShotNotesCard from './ShotNotesCard.jsx';

const DECIMALS = 2;
function round2(v) {
  if (v == null || isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function HistoryCard({ shot, onDelete, onLoad }) {
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

  const handleNotesLoaded = useCallback(notes => {
    setShotNotes(notes);
  }, []);

  const handleNotesUpdate = useCallback(notes => {
    setShotNotes(notes);
  }, []);
  return (
    <Card sm={12}>
      <div className='flex flex-col'>
        <div className='flex flex-row items-start gap-3'>
          <button
            className='shrink-0 rounded-md border px-2 py-1 text-sm'
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next && !shot.loaded && onLoad) onLoad(shot.id);
            }}
          >
            {expanded ? '-' : '+'}
          </button>
          <div className='flex-grow'>
            <div className='flex flex-row'>
              <span className='flex-grow text-xl leading-tight font-bold'>
                {shot.profile} - {date.toLocaleString()}
              </span>
              {shot.incomplete && (
                <span className='bg-warning/20 text-warning border-warning/40 ml-2 shrink-0 rounded border px-2 py-1 text-xs font-semibold'>
                  INCOMPLETE
                </span>
              )}
              <div className='flex flex-row justify-end gap-2'>
                <div
                  className='tooltip tooltip-left'
                  data-tip={shot.loaded ? 'Export' : 'Load first'}
                >
                  <button
                    disabled={!shot.loaded}
                    onClick={() => onExport()}
                    className='group text-info hover:bg-info/10 active:border-info/20 inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold disabled:opacity-40'
                    aria-label='Export shot data'
                  >
                    <FontAwesomeIcon icon={faFileExport} />
                  </button>
                </div>
                <div className='tooltip tooltip-left' data-tip='Delete'>
                  <button
                    onClick={() => onDelete(shot.id)}
                    className='group text-error hover:bg-error/10 active:border-error/20 inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold'
                    aria-label='Delete shot'
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                </div>
              </div>
            </div>
            <div className='flex flex-row items-center gap-4'>
              <div className='flex flex-row items-center gap-2'>
                <FontAwesomeIcon icon={faClock} />
                {(shot.duration / 1000).toFixed(1)}s
              </div>
              {shot.volume && shot.volume > 0 && (
                <div className='flex flex-row items-center gap-2'>
                  <FontAwesomeIcon icon={faWeightScale} />
                  {round2(shot.volume)}g
                </div>
              )}
            </div>
          </div>
        </div>
        {expanded && (
          <div className='mt-2'>
            {!shot.loaded && <div className='py-6 text-sm opacity-70'>Loading…</div>}
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
    </Card>
  );
}
