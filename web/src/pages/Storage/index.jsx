import { useState } from 'preact/hooks';

import { archiveService } from '../../services/ArchiveService.js';
import { archiveZipService } from '../../services/ArchiveZipService.js';

const REVIEW_ITEMS = [
  'Coffee shot history',
  'Profiles',
  'Notes and ratings',
  'Safe archive metadata',
];

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function countLabel(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '—';
}

function getEstimatedSize(bundle) {
  const metrics = bundle?.manifest?.storageMetrics || {};
  return (metrics.shotsJsonBytes || 0) + (metrics.profilesJsonBytes || 0) + (metrics.notesJsonBytes || 0);
}

function downloadWithAnchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

async function saveBackupFile(blob, filename) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'GaggiGo Backup',
            accept: {
              'application/zip': ['.zip'],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write({ type: 'write', data: blob });
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error;
      }

      console.warn('File picker save failed; falling back to browser download', error);
    }
  }

  downloadWithAnchor(blob, filename);
  return 'requested';
}

export function Storage() {
  const [reviewingBackup, setReviewingBackup] = useState(false);
  const [backupBundle, setBackupBundle] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupReady, setBackupReady] = useState(null);
  const [backupSaved, setBackupSaved] = useState(false);
  const [backupDownloadRequested, setBackupDownloadRequested] = useState(false);
  const [backupError, setBackupError] = useState('');

  async function openBackupReview() {
    setReviewingBackup(true);
    setBackupLoading(true);
    setBackupReady(null);
    setBackupSaved(false);
    setBackupDownloadRequested(false);
    setBackupError('');

    try {
      const bundle = await archiveService.prepareArchiveBundle();
      setBackupBundle(bundle);
    } catch (error) {
      console.error('Failed to prepare backup review', error);
      setBackupBundle(null);
      setBackupError('Backup details could not be loaded. Try again before creating a backup.');
    } finally {
      setBackupLoading(false);
    }
  }

  async function createBackup() {
    setBackupCreating(true);
    setBackupReady(null);
    setBackupSaved(false);
    setBackupDownloadRequested(false);
    setBackupError('');

    try {
      const result = await archiveZipService.buildZipArchive();

      if (!result.success) {
        setBackupError(result.reason || 'Backup could not be created.');
        return;
      }

      setBackupReady(result);
    } catch (error) {
      console.error('Failed to create backup', error);
      setBackupError('Backup could not be created. Try again.');
    } finally {
      setBackupCreating(false);
    }
  }

  async function downloadBackup() {
    if (!backupReady?.blob || !backupReady?.filename) {
      return;
    }

    setBackupSaving(true);
    setBackupError('');

    try {
      const result = await saveBackupFile(backupReady.blob, backupReady.filename);
      setBackupSaved(result === 'saved');
      setBackupDownloadRequested(result === 'requested');
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      console.error('Failed to save backup', error);
      setBackupError(
        `Backup was created, but the file could not be saved. ${error?.name || 'Error'}: ${error?.message || 'Unknown save error'}`,
      );
    } finally {
      setBackupSaving(false);
    }
  }

  function closeBackupReview() {
    setReviewingBackup(false);
    setBackupReady(null);
    setBackupSaved(false);
    setBackupDownloadRequested(false);
    setBackupError('');
  }

  const counts = backupBundle?.manifest?.counts || backupReady?.manifest?.counts || {};
  const estimatedSize = getEstimatedSize(backupBundle);
  const reviewBadge = backupCreating ? 'Creating' : backupReady ? 'Backup Ready' : backupLoading ? 'Loading' : 'Review';
  const backupFilename = backupReady?.filename || '';

  return (
    <div className='space-y-6'>
      <div className='card bg-base-100 shadow-xl'>
        <div className='card-body'>
          <div className='max-w-3xl'>
            <h1 className='card-title text-3xl'>Storage</h1>

            <p className='text-base-content/70 mt-3 text-base'>
              Protect your coffee history and profiles by creating backups you can restore later.
            </p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
        <div className='card bg-base-100 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title'>Create Backup</h2>

            <p className='text-base-content/70'>Save a backup copy of your coffee data.</p>

            {!reviewingBackup && (
              <div className='card-actions mt-4'>
                <button type='button' className='btn btn-primary w-full sm:w-auto' onClick={openBackupReview}>
                  Create Backup
                </button>
              </div>
            )}

            {reviewingBackup && (
              <div className='border-base-300 mt-5 rounded-box border p-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                  <div>
                    <h3 className='font-semibold'>{backupReady ? 'Backup Ready' : 'Review Backup'}</h3>
                    <p className='text-base-content/60 mt-1 text-sm'>
                      {backupReady
                        ? `Your backup is ready to save: ${backupFilename}`
                        : 'Check what will be included before creating a backup.'}
                    </p>
                  </div>

                  <span className='badge badge-info'>{reviewBadge}</span>
                </div>

                {backupError && <div className='alert alert-warning mt-4 text-sm'>{backupError}</div>}

                {backupReady && (
                  <div className='alert alert-success mt-4 text-sm'>
                    Backup created successfully. Save {backupFilename} somewhere safe.
                  </div>
                )}

                {backupSaved && (
                  <div className='alert alert-info mt-4 text-sm'>
                    Backup saved as {backupFilename}.
                  </div>
                )}

                {backupDownloadRequested && (
                  <div className='alert alert-info mt-4 text-sm'>
                    Browser download requested for {backupFilename}. Check your browser downloads list or downloads folder.
                  </div>
                )}

                <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
                  <div className='bg-base-200 rounded-box p-3'>
                    <div className='text-base-content/60 text-xs uppercase'>Shots</div>
                    <div className='mt-1 text-lg font-semibold'>
                      {backupLoading ? 'Loading' : countLabel(counts.shots)}
                    </div>
                  </div>

                  <div className='bg-base-200 rounded-box p-3'>
                    <div className='text-base-content/60 text-xs uppercase'>Profiles</div>
                    <div className='mt-1 text-lg font-semibold'>
                      {backupLoading ? 'Loading' : countLabel(counts.profiles)}
                    </div>
                  </div>

                  <div className='bg-base-200 rounded-box p-3'>
                    <div className='text-base-content/60 text-xs uppercase'>Estimated Size</div>
                    <div className='mt-1 text-lg font-semibold'>
                      {backupLoading ? 'Loading' : formatBytes(estimatedSize)}
                    </div>
                  </div>
                </div>

                <div className='mt-4'>
                  <h4 className='text-sm font-semibold'>Backup contents</h4>
                  <ul className='text-base-content/70 mt-2 list-inside list-disc text-sm'>
                    {REVIEW_ITEMS.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className='card-actions mt-5 justify-end'>
                  <button
                    type='button'
                    className='btn btn-ghost w-full sm:w-auto'
                    onClick={closeBackupReview}
                    disabled={backupCreating || backupSaving}
                  >
                    Back
                  </button>

                  {!backupReady && (
                    <button
                      type='button'
                      className='btn btn-primary w-full sm:w-auto'
                      onClick={createBackup}
                      disabled={backupLoading || backupCreating || Boolean(backupError)}
                    >
                      {backupCreating ? 'Creating Backup' : 'Create Backup'}
                    </button>
                  )}

                  {backupReady && (
                    <button
                      type='button'
                      className='btn btn-primary w-full sm:w-auto'
                      onClick={downloadBackup}
                      disabled={backupSaving}
                    >
                      {backupSaving ? 'Saving Backup' : 'Save Backup'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='card bg-base-100 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title'>Restore Backup</h2>

            <p className='text-base-content/70'>Restore coffee data from a backup file.</p>

            <div className='card-actions mt-4'>
              <button type='button' className='btn btn-primary w-full sm:w-auto' disabled>
                Restore Backup
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='card bg-base-100 shadow-xl'>
        <div className='card-body'>
          <h2 className='card-title'>Archive Information</h2>

          <p className='text-base-content/60 text-sm'>
            Backup activity will appear here after backups are created or restored.
          </p>
        </div>
      </div>
    </div>
  );
}
