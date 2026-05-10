import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { createBackupBundle, restoreBackupBundle } from '../../utils/backupBundle.js';
import {
  downloadGoogleDriveBackup,
  getStoredGoogleDriveClientId,
  invalidateToken,
  listGoogleDriveBackups,
  setStoredGoogleDriveClientId,
  uploadGoogleDriveBackup,
} from '../../utils/googleDriveBackup.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloudArrowUp,
  faRotate,
  faCheck,
  faFileArrowDown,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_BORDER = {
  success: 'border-[var(--color-success,#4caf50)]',
  error: 'border-[var(--color-error,#e05252)]',
  info: 'border-[var(--color-warning,#d4a843)]',
};

export function GoogleDriveBackupCard({ apiService, onRestoreComplete }) {
  const [clientId, setClientId] = useState(() => getStoredGoogleDriveClientId());
  const [busyAction, setBusyAction] = useState('');
  const [status, setStatus] = useState({ text: '', type: 'info' });
  const [latestBackup, setLatestBackup] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);

  const hasClientId = clientId.trim().length > 0;
  const isBusy = busyAction.length > 0;

  const setMsg = useCallback((text, type = 'info') => setStatus({ text, type }), []);

  const latestBackupLabel = useMemo(() => {
    if (!latestBackup?.modifiedTime) return 'No backup found';
    return new Date(latestBackup.modifiedTime).toLocaleString();
  }, [latestBackup]);

  const refreshLatestBackup = useCallback(async () => {
    if (!clientId.trim()) return null;
    const files = await listGoogleDriveBackups(clientId.trim());
    const latest = files[0] || null;
    setLatestBackup(latest);
    return latest;
  }, [clientId]);

  useEffect(() => {
    refreshLatestBackup().catch(() => {});
  }, [refreshLatestBackup]);

  const saveClientId = useCallback(() => {
    if (!clientId.trim()) {
      setMsg('Enter a Google OAuth client ID first.', 'error');
      return;
    }
    setStoredGoogleDriveClientId(clientId.trim());
    setMsg('Client ID saved in this browser.', 'success');
  }, [clientId, setMsg]);

  const handleDisconnect = useCallback(() => {
    invalidateToken();
    setStoredGoogleDriveClientId('');
    setClientId('');
    setLatestBackup(null);
    setMsg('Disconnected from Google Drive.', 'info');
  }, [setMsg]);

  const handleBackup = useCallback(async () => {
    if (!apiService) { setMsg('WebSocket is not connected yet.', 'error'); return; }
    setBusyAction('backup');
    setMsg('Building backup bundle...');
    try {
      setStoredGoogleDriveClientId(clientId.trim());
      const bundle = await createBackupBundle(apiService);
      setMsg('Uploading to Google Drive...');
      await uploadGoogleDriveBackup(clientId.trim(), bundle);
      const latest = await refreshLatestBackup();
      setMsg(
        latest
          ? `Backup saved at ${new Date(latest.modifiedTime).toLocaleString()}.`
          : 'Backup saved to Google Drive.',
        'success',
      );
    } catch (error) {
      console.error('Google Drive backup failed:', error);
      setMsg(`Backup failed: ${error.message}`, 'error');
    } finally {
      setBusyAction('');
    }
  }, [apiService, clientId, refreshLatestBackup, setMsg]);

  const handleRestoreClick = useCallback(async () => {
    if (!apiService) { setMsg('WebSocket is not connected yet.', 'error'); return; }
    setBusyAction('restore-check');
    setMsg('Looking for the latest backup...');
    try {
      setStoredGoogleDriveClientId(clientId.trim());
      const latest = (await refreshLatestBackup()) || null;
      if (!latest?.id) {
        throw new Error('No backup file found in Google Drive app storage.');
      }
      setPendingRestore(latest);
      setMsg('');
    } catch (error) {
      console.error('Restore check failed:', error);
      setMsg(`Restore failed: ${error.message}`, 'error');
    } finally {
      setBusyAction('');
    }
  }, [apiService, clientId, refreshLatestBackup, setMsg]);

  const handleRestoreConfirm = useCallback(async () => {
    if (!pendingRestore) return;
    const target = pendingRestore;
    setPendingRestore(null);
    setBusyAction('restore');
    setMsg('Downloading backup from Google Drive...');
    try {
      const bundle = await downloadGoogleDriveBackup(clientId.trim(), target.id);
      setMsg('Restoring backup data...');
      await restoreBackupBundle(apiService, bundle);
      setMsg('Restore complete.', 'success');
      onRestoreComplete?.();
    } catch (error) {
      console.error('Google Drive restore failed:', error);
      setMsg(`Restore failed: ${error.message}`, 'error');
    } finally {
      setBusyAction('');
    }
  }, [apiService, clientId, onRestoreComplete, pendingRestore, setMsg]);

  const handleExportLocal = useCallback(async () => {
    if (!apiService) { setMsg('WebSocket is not connected yet.', 'error'); return; }
    setBusyAction('export');
    setMsg('Building backup bundle...');
    try {
      const bundle = await createBackupBundle(apiService);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gaggimate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Backup downloaded.', 'success');
    } catch (error) {
      console.error('Local export failed:', error);
      setMsg(`Export failed: ${error.message}`, 'error');
    } finally {
      setBusyAction('');
    }
  }, [apiService, setMsg]);

  return (
    <Card sm={10} lg={5} title='Google Drive Backup'>
      <div className='flex flex-col gap-5'>
        <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
          Save and restore settings, profiles, beans, and shot history using a private file in your
          Google Drive app storage.
        </div>

        <div className='flex flex-col gap-2'>
          <label
            htmlFor='googleDriveClientId'
            className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
          >
            Google OAuth Client ID
          </label>
          <input
            id='googleDriveClientId'
            type='text'
            className='nd-input nd-input--lg'
            placeholder='1234567890-abc123.apps.googleusercontent.com'
            value={clientId}
            onChange={e => setClientId(e.target.value)}
          />
          <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mt-1'>
            Stored in this browser only. Use a Web application OAuth client with the Google Drive
            API enabled.
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            className='nd-action-btn'
            title='Save client ID'
            onClick={saveClientId}
            disabled={isBusy}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button
            type='button'
            className='nd-action-btn nd-action-btn--primary'
            title='Back up to Google Drive'
            onClick={handleBackup}
            disabled={!hasClientId || isBusy}
          >
            {busyAction === 'backup' ? <Spinner size={4} /> : <FontAwesomeIcon icon={faCloudArrowUp} />}
          </button>
          <button
            type='button'
            className='nd-action-btn'
            title='Restore from Google Drive'
            onClick={handleRestoreClick}
            disabled={!hasClientId || isBusy}
          >
            {busyAction === 'restore' || busyAction === 'restore-check' ? (
              <Spinner size={4} />
            ) : (
              <FontAwesomeIcon icon={faRotate} />
            )}
          </button>
          <button
            type='button'
            className='nd-action-btn'
            title='Download backup as local JSON file'
            onClick={handleExportLocal}
            disabled={!apiService || isBusy}
          >
            {busyAction === 'export' ? <Spinner size={4} /> : <FontAwesomeIcon icon={faFileArrowDown} />}
          </button>
          {hasClientId && (
            <button
              type='button'
              className='nd-action-btn'
              title='Disconnect Google Drive'
              onClick={handleDisconnect}
              disabled={isBusy}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>

        {pendingRestore && (
          <div className='nd-card p-4 flex flex-col gap-3'>
            <div className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)]'>
              Restore backup from {new Date(pendingRestore.modifiedTime).toLocaleString()}
              {pendingRestore.size ? ` (${formatBytes(pendingRestore.size)})` : ''}?
            </div>
            <div className='flex gap-2'>
              <button
                type='button'
                className='nd-action-btn nd-action-btn--primary'
                onClick={handleRestoreConfirm}
                disabled={isBusy}
              >
                Restore
              </button>
              <button
                type='button'
                className='nd-action-btn'
                onClick={() => { setPendingRestore(null); setMsg(''); }}
                disabled={isBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className='nd-card p-4'>
          <div className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
            Latest Drive backup
          </div>
          <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-1'>
            {latestBackupLabel}
          </div>
          {latestBackup?.size ? (
            <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mt-1'>
              {formatBytes(latestBackup.size)}
            </div>
          ) : null}
        </div>

        {status.text ? (
          <div className={`border-l-2 ${STATUS_BORDER[status.type] ?? STATUS_BORDER.info} pl-4`}>
            <span className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
              {status.text}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
