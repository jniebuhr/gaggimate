import Card from '../../components/Card.jsx';
import { useCallback, useState, useContext, useRef, useEffect } from 'preact/hooks';
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
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import ShotNotesCard from './ShotNotesCard.jsx';
import { HoldToConfirmButton } from '../../components/HoldToConfirmButton.jsx';

import VisualizerUploadModal from '../../components/VisualizerUploadModal.jsx';
import { visualizerService } from '../../services/VisualizerService.js';
import { ApiServiceContext } from '../../services/ApiService.js';
import { Tooltip } from '../../components/Tooltip.jsx';

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function HistoryCard({ shot, onDelete, onLoad, onNotesChanged }) {
  const apiService = useContext(ApiServiceContext);
  const [shotNotes, setShotNotes] = useState(shot.notes || null);
  const [expanded, setExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [dropdownOpen]);

  const closeDropdownMenu = useCallback(() => {
    setDropdownOpen(false);
  }, []);
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
        systemInfo: s.systemInfo,
        phaseNumber: s.phaseNumber,
        phaseDisplayNumber: s.phaseDisplayNumber,
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
  let formattedDate = 'No timestamp available';
  if (date.getFullYear() > 1970) {
    formattedDate =
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

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
    <Card className='col-span-12'>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-row items-start gap-2'>
          <button
            className='border-base-content/20 text-base-content/60 hover:text-base-content hover:bg-base-content/10 hover:border-base-content/40 cursor-pointer rounded-md border p-2 transition-all duration-200'
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next) setHasOpened(true);
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
                {expanded &&
                  shot.loaded &&
                  shot.samples &&
                  shot.samples.length > 0 &&
                  shot.samples[0].systemInfo && (
                    <p className='text-base-content/60 text-xs italic'>
                      Brewed by{' '}
                      {shot.samples[0].systemInfo.shotStartedVolumetric ? 'Weight' : 'Time'}
                    </p>
                  )}
              </div>

              <div className='flex shrink-0 flex-row items-center gap-2'>
                {shot.incomplete && (
                  <span className='inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800'>
                    INCOMPLETE
                  </span>
                )}

                <div
                  className={`action-dropdown relative ${dropdownOpen ? 'action-dropdown-open' : ''}`}
                  ref={dropdownRef}
                >
                  <button
                    onClick={() => setDropdownOpen(open => !open)}
                    className='btn btn-sm btn-ghost btn-circle'
                    aria-label={`Open actions menu for shot ${shot.id}`}
                    aria-expanded={dropdownOpen}
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </button>
                  <ul className='menu action-dropdown-menu bg-base-100 rounded-box border-base-content/10 right-0 z-50 mt-1 w-52 border p-2 shadow-lg'>
                    <li>
                      <button
                        disabled={!shot.loaded}
                        onClick={() => {
                          onExport();
                          closeDropdownMenu();
                        }}
                        className='justify-start disabled:opacity-50'
                        aria-label='Export shot data'
                      >
                        <FontAwesomeIcon icon={faFileExport} />
                        <span>Export</span>
                      </button>
                    </li>
                    <li>
                      <a
                        href={`/analysis/analyzer/internal/${shot.id}`}
                        onClick={closeDropdownMenu}
                        className='justify-start'
                        aria-label='Open in Analyzer'
                      >
                        <FontAwesomeIcon icon={faMagnifyingGlassChart} />
                        <span>Analyzer</span>
                      </a>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setShowUploadModal(true);
                          closeDropdownMenu();
                        }}
                        disabled={!canUpload}
                        className='justify-start disabled:opacity-50'
                        aria-label='Upload to visualizer.coffee'
                      >
                        <FontAwesomeIcon icon={faUpload} />
                        <span>Upload</span>
                      </button>
                    </li>
                    <li>
                      <HoldToConfirmButton
                        onConfirm={() => {
                          onDelete(shot.id);
                          closeDropdownMenu();
                        }}
                        className='justify-start text-error hover:bg-error/10 active:!bg-transparent active:!text-error'
                        aria-label='Hold to delete shot'
                        holdDurationMs={2000}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                        <span>Hold to Delete</span>
                      </HoldToConfirmButton>
                    </li>
                  </ul>
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

            <div
              className='grid transition-all duration-[250ms] ease-out'
              style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
            >
              <div className='overflow-hidden'>
                {hasOpened && (
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
