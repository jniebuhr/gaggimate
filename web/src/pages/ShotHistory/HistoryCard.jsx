import Card from '../../components/Card.jsx';
import { useCallback, useState, useContext } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson, prepareDownload } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faCodeBranch } from '@fortawesome/free-solid-svg-icons/faCodeBranch';
import ShotNotesCard from './ShotNotesCard.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';

import VisualizerUploadModal from '../../components/VisualizerUploadModal.jsx';
import { visualizerService } from '../../services/VisualizerService.js';
import { ApiServiceContext } from '../../services/ApiService.js';
import { Tooltip } from '../../components/Tooltip.jsx';
import { formatTenPointRating, getRatingFillPercent } from '../../utils/ratings.js';
import { useLocation } from 'preact-iso';

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function HistoryCard({ shot, onDelete, onLoad, onNotesChanged }) {
  const apiService = useContext(ApiServiceContext);
  const location = useLocation();
  const isManualShot = !shot.profileId || shot.profileId.trim() === '';
  const [shotNotes, setShotNotes] = useState(shot.notes || null);
  const [expanded, setExpanded] = useState(false);
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const date = new Date(shot.timestamp * 1000);
  const effectiveRating = shotNotes?.rating ?? shot.rating ?? 0;
  const hasSamples = Array.isArray(shot.samples) && shot.samples.length > 0;

  const onExport = useCallback(async () => {
    const download = prepareDownload('shot-' + shot.id + '.json');
    setIsExporting(true);
    try {
      const exportShot = !shot.loaded && onLoad ? await onLoad(shot) : shot;
      if (!exportShot?.loaded) {
        throw new Error('Shot data is not available yet.');
      }

      const exportData = { ...exportShot, notes: shotNotes };
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
          systemInfo: s.systemInfo,
          phaseNumber: s.phaseNumber,
          phaseDisplayNumber: s.phaseDisplayNumber,
        }));
      }
      exportData.volume = round2(exportData.volume);
      downloadJson(exportData, 'shot-' + shot.id + '.json', download);
    } catch (error) {
      console.error('Failed to export shot:', error);
      download.fail(error);
      alert(`Shot export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [onLoad, shot, shotNotes]);

  const handleNotesLoaded = useCallback(notes => {
    setShotNotes(notes);
  }, []);

  const handleNotesUpdate = useCallback(
    notes => {
      setShotNotes(notes);
      // Notify parent that notes changed (so it can reload the index)
      if (onNotesChanged) onNotesChanged(shot.id, notes, shot.source);
    },
    [onNotesChanged, shot.id, shot.source],
  );
  const profileTitle = shot.beanName
    ? `${shot.profile || 'Unknown Profile'} \u2022 ${shot.beanName}`
    : shot.profile || 'Unknown Profile';
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
    <Card sm={12} className='min-w-0'>
      <div className='flex flex-col gap-2'>
        <div className='flex min-w-0 flex-row items-start gap-3'>
          <button
            className='nd-action-btn nd-action-btn--text shrink-0'
            style={{ width: '36px', height: '36px', minWidth: 'unset', padding: '8px' }}
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next && !shot.loaded && onLoad) onLoad(shot.id);
            }}
            aria-label={expanded ? 'Collapse shot details' : 'Expand shot details'}
          >
            <FontAwesomeIcon icon={expanded ? faMinus : faPlus} className='text-[12px]' />
          </button>

          <div className='min-w-0 flex-grow overflow-hidden'>
            {/* Header Row */}
            <div className='flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
              <div className='min-w-0 flex-grow'>
                <h3 className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)] truncate'>
                  {profileTitle}
                </h3>
                <p className='font-nd-mono text-[12px] text-[var(--text-secondary,#999)] mt-1'>
                  #{shot.id} \u2022 {formattedDate}
                </p>
                {expanded &&
                  shot.loaded &&
                  shot.samples &&
                  shot.samples.length > 0 &&
                  shot.samples[0].systemInfo && (
                    <p className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mt-1 italic'>
                      Brewed by {shot.samples[0].systemInfo.shotStartedVolumetric ? 'Weight' : 'Time'}
                    </p>
                  )}
              </div>

              <div className='flex shrink-0 flex-wrap items-center gap-2 xl:justify-end'>
                <span
                  className={`font-nd-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 ${
                    shot.source === 'browser'
                      ? 'bg-[rgba(139,92,246,0.15)] text-[#8b5cf6]'
                      : 'bg-[rgba(59,130,246,0.15)] text-[#3b82f6]'
                  }`}
                >
                  {shot.source === 'browser' ? 'Imported' : 'Device'}
                </span>
                {shot.incomplete && (
                  <span className='font-nd-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 bg-[rgba(234,179,8,0.15)] text-[var(--color-warning,#d4a843)]'>
                    Incomplete
                  </span>
                )}

                <div className='flex flex-wrap gap-1'>
                  <button
                    disabled={isExporting}
                    onClick={onExport}
                    className='nd-action-btn'
                    style={{ width: '32px', height: '32px' }}
                    aria-label='Export shot data'
                  >
                    <FontAwesomeIcon icon={faFileExport} className='text-[12px]' />
                  </button>

                  <a
                    href={`/analyzer/internal/${shot.id}`}
                    className='nd-action-btn'
                    style={{ width: '32px', height: '32px' }}
                    aria-label='Open in Analyzer'
                  >
                    <FontAwesomeIcon icon={faMagnifyingGlassChart} className='text-[12px]' />
                  </a>

                  <button
                    onClick={() => setShowUploadModal(true)}
                    disabled={!canUpload}
                    className={`nd-action-btn ${canUpload ? '' : 'opacity-40 cursor-not-allowed'}`}
                    style={{ width: '32px', height: '32px' }}
                    aria-label='Upload to visualizer.coffee'
                  >
                    <FontAwesomeIcon icon={faUpload} className='text-[12px]' />
                  </button>
                  {isManualShot && shot.source !== 'browser' && (
                    <button
                      onClick={() => location.route(`/shots/${shot.id}/to-profile`)}
                      className='nd-action-btn'
                      style={{ width: '32px', height: '32px' }}
                      aria-label='Save as profile'
                      title='Save as profile'
                    >
                      <FontAwesomeIcon icon={faCodeBranch} className='text-[12px]' />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      confirmOrDelete(() => onDelete(shot.id));
                    }}
                    className='nd-action-btn'
                    style={{ width: '32px', height: '32px' }}
                    aria-label={confirmDelete ? 'Confirm deletion of shot' : 'Delete shot'}
                  >
                    <FontAwesomeIcon
                      icon={faTrashCan}
                      className={`text-[12px] ${confirmDelete ? 'text-[var(--color-error,#d71921)]' : ''}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-2'>
              <div className='flex items-center gap-1'>
                <FontAwesomeIcon icon={faClock} className='text-[var(--text-disabled,#666)] text-[10px]' />
                <span className='font-nd-mono text-[12px] text-[var(--text-secondary,#999)]'>
                  {(shot.duration / 1000).toFixed(1)}s
                </span>
              </div>

              {shot.volume && shot.volume > 0 && (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faWeightScale} className='text-[var(--text-disabled,#666)] text-[10px]' />
                  <span className='font-nd-mono text-[12px] text-[var(--text-secondary,#999)]'>
                    {round2(shot.volume)}g
                  </span>
                </div>
              )}

              {effectiveRating && effectiveRating > 0 ? (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faStar} className='text-[var(--color-warning,#d4a843)] text-[10px]' />
                  <span className='font-nd-mono text-[12px] text-[var(--text-secondary,#999)]'>
                    {formatTenPointRating(effectiveRating)}
                  </span>
                </div>
              ) : (
                <div className='flex items-center gap-1'>
                  <FontAwesomeIcon icon={faStar} className='text-[var(--text-disabled,#666)] text-[10px]' />
                  <span className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)]'>Unrated</span>
                </div>
              )}
            </div>

            {expanded && (
              <div className='mt-4 border-t border-[var(--home-border,#222)] pt-4'>
                {!shot.loaded && (
                  <div className='flex items-center justify-center py-8'>
                    <span className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>Loading shot data...</span>
                  </div>
                )}
                {shot.loaded && hasSamples && <HistoryChart shot={shot} />}
                {shot.loaded && (
                  <ShotNotesCard
                    shot={shot}
                    onNotesLoaded={handleNotesLoaded}
                    onNotesUpdate={handleNotesUpdate}
                  />
                )}
                {shot.loaded && !hasSamples && (
                  <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-4'>
                    This backup contains shot details and notes, but not the full sample trace.
                  </div>
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
