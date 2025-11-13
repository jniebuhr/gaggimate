import { useEffect, useRef, useState } from 'preact/hooks';
import { logs } from '../services/ApiService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';

export default function DebugLogs() {
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const consoleRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs.value, autoScroll]);

  const handleClear = () => {
    logs.value = '';
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch('/api/logs');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const logText = await response.text();
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      // Format date as YYYY-MM-DD-HH-MM-SS
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/T/, '-')
        .replace(/:/g, '-')
        .replace(/\..+/, '');

      a.href = url;
      a.download = `gaggimate-logs-${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
      setExportError(error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredText = filter
    ? logs.value
      .split('\n')
      .filter(line => line.toLowerCase().includes(filter.toLowerCase()))
      .join('\n')
    : logs.value;

  const colorizeLogLine = line => {
    if (line.includes('[E]')) return 'text-error';
    if (line.includes('[W]')) return 'text-warning';
    if (line.includes('[I]')) return 'text-base-content';
    if (line.includes('[D]')) return 'text-base-content opacity-70';
    if (line.includes('[V]')) return 'text-base-content opacity-50';
    return 'text-base-content';
  };

  const logLines = filteredText.split('\n').filter(line => line.trim());

  return (
    <div className='flex flex-col gap-4'>
      {/* Error Alert */}
      {exportError && (
        <div className='alert alert-error'>
          <div>
            <span className='font-semibold'>Failed to export logs:</span>
            <span className='ml-2'>{exportError}</span>
          </div>
          <button
            className='btn btn-sm btn-ghost'
            onClick={() => setExportError(null)}
            aria-label='Dismiss error'
          >
            ✕
          </button>
        </div>
      )}

      {/* Controls */}
      <div className='flex flex-wrap gap-2 items-center justify-between'>
            <div className='flex gap-2 items-center flex-wrap'>
              <div className='tooltip' data-tip='Clear logs'>
                <button
                  className='text-base-content/50 hover:text-error hover:bg-error/10 rounded-md p-2 transition-colors'
                  onClick={handleClear}
                  aria-label='Clear logs'
                >
                  <FontAwesomeIcon icon={faTrashCan} className='h-4 w-4' />
                </button>
              </div>
              <div className='tooltip' data-tip='Download log file'>
                <button
                  className='text-base-content/50 hover:text-info hover:bg-info/10 rounded-md p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  onClick={handleExport}
                  disabled={isExporting}
                  aria-label='Download log file'
                >
                  {isExporting ? (
                    <span className='loading loading-spinner loading-xs' />
                  ) : (
                    <FontAwesomeIcon icon={faFileExport} className='h-4 w-4' />
                  )}
                </button>
              </div>
              <label className='label cursor-pointer gap-2'>
                <span className='label-text'>Auto-scroll</span>
                <input
                  type='checkbox'
                  className='toggle toggle-primary'
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                />
              </label>
            </div>

            <div className='flex gap-2 items-center flex-wrap'>
              <input
                type='text'
                placeholder='Filter logs...'
                className='input input-sm input-bordered w-48'
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />

              <span className='text-sm opacity-70'>
                {logLines.length} lines
                {logs.value.length > 0 && ` (~${(logs.value.length / 1024).toFixed(1)}KB)`}
              </span>
            </div>
          </div>

      {/* Console Output */}
      <div className='overflow-hidden'>
          <div
            ref={consoleRef}
            className='font-mono text-xs overflow-auto h-full p-4 whitespace-pre'
            style={{ maxHeight: '65vh' }}
          >
            {logLines.length === 0 ? (
              <div className='text-center text-base-content opacity-50 py-8'>
                {logs.value.length === 0
                  ? 'No logs to show yet...'
                  : 'No logs match the current filter.'}
              </div>
            ) : (
              logLines.map((line, index) => (
                <div key={index} className={colorizeLogLine(line)}>
                  {line}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
      </div>
    </div>
  );
}
