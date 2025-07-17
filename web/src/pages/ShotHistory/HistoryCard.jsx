import Card from '../../components/Card.jsx';
import { useCallback } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';

export default function HistoryCard({ shot, onDelete }) {
  const date = new Date(shot.timestamp * 1000);
  const onExport = useCallback(() => {
    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(shot, undefined, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', shot.id + '.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
  return (
    <Card xs={12}>
      <div className="flex flex-row">
        <span className="font-bold text-xl leading-tight flex-grow">
          {shot.profile} - {date.toLocaleString()}
        </span>

        <div className="flex flex-row gap-2 justify-end">
          <a
            href="javascript:void(0)"
            tooltip="Export"
            tooltip-position="left"
            onClick={() => onExport()}
            className="group inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 active:border-blue-200"
          >
            <span className="fa fa-file-export" />
          </a>
          <a
            href="javascript:void(0)"
            tooltip="Delete"
            tooltip-position="left"
            onClick={() => onDelete(shot.id)}
            className="group inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 active:border-red-200"
          >
            <span className="fa fa-trash" />
          </a>
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
