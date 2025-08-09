import Card from '../../components/Card.jsx';
import { useCallback } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';

export default function HistoryCard({ shot, onDelete }) {
  const date = new Date(shot.timestamp * 1000);
  const onExport = useCallback(() => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(shot, undefined, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', shot.id + '.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
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
              <span className='fa fa-file-export' />
            </button>
          </div>
          <div className='tooltip tooltip-left' data-tip='Delete'>
            <button
              onClick={() => onDelete(shot.id)}
              className='group text-error hover:bg-error/10 active:border-error/20 inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold'
              aria-label='Delete shot'
            >
              <span className='fa fa-trash' />
            </button>
          </div>
        </div>
      </div>
      <div className='flex flex-row items-center gap-4'>
        <div className='flex flex-row items-center gap-2'>
          <span className='fa fa-clock'></span>
          {(shot.duration / 1000).toFixed(1)}s
        </div>
        {shot.volume && (
          <div className='flex flex-row items-center gap-2'>
            <span className='fa fa-scale-balanced'></span>
            {shot.volume}g
          </div>
        )}
      </div>
      <div>
        <HistoryChart shot={shot} />
      </div>
    </Card>
  );
}
