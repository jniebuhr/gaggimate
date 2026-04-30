import { useCallback, useMemo, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { createBackupBundle, restoreBackupBundle } from '../../utils/backupBundle.js';
import {
  downloadGoogleDriveBackup,
  getStoredGoogleDriveClientId,
  listGoogleDriveBackups,
  setStoredGoogleDriveClientId,
  uploadGoogleDriveBackup,
} from '../../utils/googleDriveBackup.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudArrowUp, faRotate, faCheck } from '@fortawesome/free-solid-svg-icons';

export function GoogleDriveBackupCard({ apiService, onRestoreComplete }) {
  const [clientId, setClientId] = useState(() => getStoredGoogleDriveClientId());
  const [busyAction, setBusyAction] = useState('');
  const [status, setStatus] = useState('');
  const [latestBackup, setLatestBackup] = useState(null);

  const hasClientId = clientId.trim().length > 0;
  const isBusy = busyAction.length > 0;

  const latestBackupLabel = useMemo(() => {
    if (!latestBackup?.modifiedTime) return 'No backup checked yet';
    return new Date(latestBackup.modifiedTime).toLocaleString();
  }, [latestBackup]);

  const refreshLatestBackup = useCallback(async () => {
    if (!clientId.trim()) return null;
    const files = await listGoogleDriveBackups(clientId.trim());
    const latest = files[0] || null;
    setLatestBackup(latest);
    return latest;
  }, [clientId]);

  const saveClientId = useCallback(() => {
    if (!clientId.trim()) {
      setStatus('Enter a Google OAuth client ID first.');
      return;
    }
    setStoredGoogleDriveClientId(clientId.trim());
    setStatus('Google Drive client ID saved in this browser.');
  }, [clientId]);

  const handleBackup = useCallback(async () => {
    if (!apiService) {
      setStatus('WebSocket is not connected yet.');
      return;
    }

    setBusyAction('backup');
    setStatus('Building backup bundle...');
    try {
      setStoredGoogleDriveClientId(clientId.trim());
      const bundle = await createBackupBundle(apiService);
      setStatus('Uploading backup to Google Drive...');
      await uploadGoogleDriveBackup(clientId.trim(), bundle);
      const latest = await refreshLatestBackup();
      setStatus(
        latest
          ? `Backup saved to Google Drive at ${new Date(latest.modifiedTime).toLocaleString()}.`
          : 'Backup saved to Google Drive.',
      );
    } catch (error) {
      console.error('Google Drive backup failed:', error);
      setStatus(`Backup failed: ${error.message}`);
    } finally {
      setBusyAction('');
    }
  }, [apiService, clientId, refreshLatestBackup]);

  const handleRestore = useCallback(async () => {
    if (!apiService) {
      setStatus('WebSocket is not connected yet.');
      return;
    }

    setBusyAction('restore');
    setStatus('Looking for the latest Google Drive backup...');
    try {
      setStoredGoogleDriveClientId(clientId.trim());
      const latest = (await refreshLatestBackup()) || null;
      if (!latest?.id) {
        throw new Error('No backup file was found in Google Drive app storage.');
      }

      const confirmed = confirm(
        `Restore the latest Google Drive backup from ${new Date(latest.modifiedTime).toLocaleString()}?`,
      );
      if (!confirmed) {
        setStatus('Restore cancelled.');
        return;
      }

      setStatus('Downloading backup from Google Drive...');
      const bundle = await downloadGoogleDriveBackup(clientId.trim(), latest.id);
      setStatus('Restoring backup data...');
      await restoreBackupBundle(apiService, bundle);
      setStatus('Restore completed. Reloading current settings...');
      onRestoreComplete?.();
    } catch (error) {
      console.error('Google Drive restore failed:', error);
      setStatus(`Restore failed: ${error.message}`);
    } finally {
      setBusyAction('');
    }
  }, [apiService, clientId, onRestoreComplete, refreshLatestBackup]);

  return (
    <Card sm={10} lg={5} title='Google Drive Backup'>
      <div className='flex flex-col gap-5'>
        <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
          Save and restore settings, profiles, beans, and shot history backups using a private file
          in your Google Drive app storage.
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
            onClick={saveClientId}
            disabled={isBusy}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button
            type='button'
            className='nd-action-btn nd-action-btn--primary'
            onClick={handleBackup}
            disabled={!hasClientId || isBusy}
          >
            {busyAction === 'backup' ? <Spinner size={4} /> : <FontAwesomeIcon icon={faCloudArrowUp} />}
          </button>
          <button
            type='button'
            className='nd-action-btn'
            onClick={handleRestore}
            disabled={!hasClientId || isBusy}
          >
            {busyAction === 'restore' ? <Spinner size={4} /> : <FontAwesomeIcon icon={faRotate} />}
          </button>
        </div>

        <div className='nd-card p-4'>
          <div className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
            Latest Drive backup
          </div>
          <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-1'>
            {latestBackupLabel}
          </div>
          {latestBackup?.size ? (
            <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mt-1'>
              {Number(latestBackup.size)} bytes
            </div>
          ) : null}
        </div>

        {status ? (
          <div className='border-l-2 border-[var(--color-warning,#d4a843)] pl-4'>
            <span className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
              {status}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
