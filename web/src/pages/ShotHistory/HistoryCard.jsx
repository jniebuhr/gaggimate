import Card from '../../components/Card.jsx';
import { useCallback } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';

export default function HistoryCard({ shot, onDelete }) {
  const date = new Date(shot.timestamp * 1000);
  const onExport = useCallback(() => {
    const jsonStr = JSON.stringify(shot, undefined, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'shot-' + shot.id + '.json';
    a.target = '_blank';
    a.rel = 'noopener';
    
    document.body.appendChild(a);
    setTimeout(() => {
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 10);
  });
  return (
    <Card xs={12}>
      <div className="flex flex-row">
        <span className="font-bold text-xl leading-tight flex-grow">
          {shot.profile} - {date.toLocaleString()}
        </span>

        <div className="flex flex-row gap-2 justify-end">
          <button
            type="button"
            data-tooltip="Export"
            data-tooltip-position="left"
            onClick={onExport}
            className="group inline-flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 active:border-blue-200 cursor-pointer"
          >
            <span className="fa fa-file-export" />
          </button>
          <button
            type="button"
            data-tooltip="Delete"
            data-tooltip-position="left"
            onClick={() => onDelete(shot.id)}
            className="group inline-flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 active:border-red-200 cursor-pointer"
          >
            <span className="fa fa-trash" />
          </button>
        </div>
      </div>
      <div className="flex flex-row gap-6 items-center">
        <div className="flex flex-row gap-2 items-center">
          <span className="fa fa-clock"></span>
          {(shot.duration / 1000).toFixed(1)}s
        </div>
        {shot.volume && (
          <div className="flex flex-row gap-2 items-center">
            <span className="fa fa-scale-balanced"></span>
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
