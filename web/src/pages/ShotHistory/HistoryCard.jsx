import Card from '../../components/Card.jsx';
import { useCallback } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import ShotNotesCard from './ShotNotesCard.jsx';
import { useState } from 'preact/hooks';

export default function HistoryCard({ shot, onDelete }) {
  const [shotNotes, setShotNotes] = useState(null);
  const date = new Date(shot.timestamp * 1000);
  const onExport = useCallback(() => {
    const exportData = {
      ...shot,
      notes: shotNotes,
    };
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
      <div className='flex flex-row'>
        <span className='flex-grow text-xl leading-tight font-bold'>
          {shot.profile} - {date.toLocaleString()}
        </span>

        <div className='flex flex-row justify-end gap-2'>
          <div className='tooltip tooltip-left' data-tip='Export'>
            <button
              onClick={() => onExport()}
              className='group text-info hover:bg-info/10 active:border-info/20 inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold'
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
            {shot.volume}g
          </div>
        )}
      </div>
      <div>
        <HistoryChart shot={shot} />
      </div>
      <ShotNotesCard
        shot={shot}
        onNotesLoaded={handleNotesLoaded}
        onNotesUpdate={handleNotesUpdate}
      />
    </Card>
  );
}
