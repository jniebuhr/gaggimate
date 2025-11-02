import Card from '../../components/Card.jsx';
import { useCallback, useState, useContext } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import ShotNotesCard from './ShotNotesCard.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';

import VisualizerUploadModal from '../../components/VisualizerUploadModal.jsx';
import { visualizerService } from '../../services/VisualizerService.js';
import { ApiServiceContext } from '../../services/ApiService.js';

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function HistoryCard({ shot, onDelete, onLoad, onNotesChanged }) {
  const apiService = useContext(ApiServiceContext);
  const [shotNotes, setShotNotes] = useState(shot.notes || null);
  const [expanded, setExpanded] = useState(false);
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleNotesUpdate = useCallback(
    notes => {
      setShotNotes(notes);
      // Notify parent that notes changed (so it can reload the index)
      if (onNotesChanged) onNotesChanged();
    },
    [onNotesChanged],
  );
  const profileTitle = shot.profile || 'Unknown Profile';
  const formattedDate =
    date.toLocaleDateString() +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleUpload = useCallback(
    async (username, password, rememberCredentials) => {
      setIsUploading(true);
      try {
        // Validate shot data
        if (!visualizerService.validateShot(shot)) {
          throw new Error('Shot data is invalid or incomplete');
        }

        // Fetch profile data if profileId is available
        let profileData = null;
        if (shot.profileId && apiService) {
          try {
            const profileResponse = await apiService.request({
              tp: 'req:profiles:load',
              id: shot.profileId,
            });
            if (profileResponse.profile) {
              profileData = profileResponse.profile;
            }
          } catch (error) {
            console.warn('Failed to fetch profile data:', error);
            // Continue without profile data
          }
        }

        // Include notes in shot data
        const shotWithNotes = {
          ...shot,
          notes: shotNotes,
        };

        await visualizerService.uploadShot(shotWithNotes, username, password, profileData);

        // Show success message
        alert('Shot uploaded successfully to visualizer.coffee!');
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Upload failed: ${error.message}`);
        throw error; // Re-throw to prevent modal from closing
      } finally {
        setIsUploading(false);
      }
    },
    [shot, shotNotes, apiService],
  );

  const canUpload = visualizerService.validateShot(shot);

  return (
    <Card sm={12} className='[&>.card-body]:p-2'>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-row items-start gap-2'>
          <button
            className='border-base-content/20 text-base-content/60 hover:text-base-content hover:bg-base-content/10 hover:border-base-content/40 rounded-md border p-2 transition-all duration-200'
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next && !shot.loaded && onLoad) onLoad(shot.id);
            }}
            aria-label={expanded ? 'Collapse shot details' : 'Expand shot details'}
          >
            <FontAwesomeIcon icon={expanded ? faMinus : faPlus} className='h-3 w-3' />
          </button>

          <div className='min-w-0 flex-grow'>
            {/* Header Row */}
            <div className='mb-1 flex flex-row items-start justify-between gap-3'>
              <div className='min-w-0 flex-grow'>
                <h3 className='text-base-content truncate text-base font-semibold'>
                  {profileTitle}
                </h3>
                <p className='text-base-content/70 text-sm'>
                  #{shot.id} • {formattedDate}
                </p>
              </div>

              <div className='flex shrink-0 flex-row items-center gap-2'>
                {shot.incomplete && (
                  <span className='inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800'>
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
                      className='text-base-content/50 hover:text-info hover:bg-info/10 rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
                      aria-label='Export shot data'
                    >
                      <FontAwesomeIcon icon={faFileExport} className='h-4 w-4' />
                    </button>
                  </div>
                  <div
                    className='tooltip tooltip-left'
                    data-tip={
                      canUpload
                        ? 'Upload to Visualizer.coffee'
                        : 'Load shot data first by expanding the shot'
                    }
                  >
                    <button
                      onClick={() => setShowUploadModal(true)}
                      disabled={!canUpload}
                      className={`group inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold ${
                        canUpload
                          ? 'text-success hover:bg-success/10 active:border-success/20'
                          : 'cursor-not-allowed text-gray-400'
                      }`}
                      aria-label='Upload to visualizer.coffee'
                    >
                      <FontAwesomeIcon icon={faUpload} />
                    </button>
                  </div>
                  <div className='tooltip tooltip-left' data-tip={confirmDelete ? 'Click to confirm delete' : 'Delete'}>
                    <button
                      onClick={() => {
                        confirmOrDelete(() => onDelete(shot.id));
                      }}
                      className={`p-2 rounded-md transition-colors ${confirmDelete ? 'bg-error text-error-content font-semibold' : 'text-base-content/50 hover:text-error hover:bg-error/10'}`}
                      aria-label={confirmDelete ? 'Confirm deletion of shot' : 'Delete shot'}
                      title={confirmDelete ? 'Click to confirm delete' : 'Delete shot'}
                    >
                      <FontAwesomeIcon icon={faTrashCan} className='w-4 h-4' />
                      {confirmDelete && <span className='ml-2 hidden sm:inline'>Confirm</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className='text-base-content/80 mb-1 flex flex-row items-center gap-4 text-sm'>
              <div className='flex items-center gap-1'>
                <FontAwesomeIcon icon={faClock} className='h-4 w-4' />
                <span>{(shot.duration / 1000).toFixed(1)}s</span>
              </div>

              {shot.volume && shot.volume > 0 && (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faWeightScale} className='h-4 w-4' />
                  <span>{round2(shot.volume)}g</span>
                </div>
              )}

              {shot.rating && shot.rating > 0 ? (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faStar} className='h-4 w-4 text-yellow-500' />
                  <span className='font-medium'>{shot.rating}/5</span>
                </div>
              ) : (
                <div className='text-base-content/50 flex items-center gap-1'>
                  <FontAwesomeIcon icon={faStar} className='h-4 w-4' />
                  <span>Not rated</span>
                </div>
              )}
            </div>

            {expanded && (
              <div className='border-base-content/20 mt-4 border-t pt-4'>
                {!shot.loaded && (
                  <div className='flex items-center justify-center py-8'>
                    <span className='text-base-content/70 text-sm'>Loading shot data...</span>
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

      <VisualizerUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
        shotInfo={{
          profile: shot.profile,
          timestamp: shot.timestamp,
          duration: shot.duration,
          volume: shot.volume,
        }}
      />
    </Card>
  );
}
