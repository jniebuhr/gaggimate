import Card from '../../components/Card.jsx';
import { useCallback, useContext } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import ShotNotesCard from './ShotNotesCard.jsx';
import { useState } from 'preact/hooks';
import VisualizerUploadModal from '../../components/VisualizerUploadModal.jsx';
import { visualizerService } from '../../services/VisualizerService.js';
import { ApiServiceContext } from '../../services/ApiService.js';

export default function HistoryCard({ shot, onDelete }) {
  const apiService = useContext(ApiServiceContext);
  const [shotNotes, setShotNotes] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const date = new Date(shot.timestamp * 1000);
  const onExport = useCallback(() => {
    const exportData = {
      ...shot,
      notes: shotNotes
    };
    downloadJson(exportData, 'shot-' + shot.id + '.json');
  }, [shot, shotNotes]);

  const handleNotesLoaded = useCallback((notes) => {
    setShotNotes(notes);
  }, []);

  const handleNotesUpdate = useCallback((notes) => {
    setShotNotes(notes);
  }, []);

  const handleUpload = useCallback(async (username, password, rememberCredentials) => {
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
            id: shot.profileId 
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
        notes: shotNotes
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
  }, [shot, shotNotes, apiService]);

  const canUpload = visualizerService.validateShot(shot);

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
              <FontAwesomeIcon icon={faFileExport} />
            </button>
          </div>
          <div className='tooltip tooltip-left' data-tip={canUpload ? 'Upload to Visualizer.coffee' : 'No data available for upload'}>
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={!canUpload}
              className={`group inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold ${
                canUpload 
                  ? 'text-success hover:bg-success/10 active:border-success/20' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              aria-label='Upload to visualizer.coffee'
            >
              <FontAwesomeIcon icon={faUpload} />
            </button>
          </div>
          <div className='tooltip tooltip-left' data-tip='Delete'>
            <button
              onClick={() => onDelete(shot.id)}
              className='group text-error hover:bg-error/10 active:border-error/20 inline-block items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold'
              aria-label='Delete shot'
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          </div>
        </div>
      </div>
      <div className='flex flex-row items-center gap-4'>
        <div className='flex flex-row items-center gap-2'>
          <FontAwesomeIcon icon={faClock} />
          {(shot.duration / 1000).toFixed(1)}s
        </div>
        {shot.volume && shot.volume > 0 && (
          <div className='flex flex-row items-center gap-2'>
            <FontAwesomeIcon icon={faWeightScale} />
            {shot.volume}g
          </div>
        )}
      </div>
      <div>
        <HistoryChart shot={shot} />
      </div>
      <ShotNotesCard 
        shot={shot} 
        onNotesLoaded={handleNotesLoaded}
        onNotesUpdate={handleNotesUpdate}
      />

      <VisualizerUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
        shotInfo={{
          profile: shot.profile,
          timestamp: shot.timestamp,
          duration: shot.duration,
          volume: shot.volume
        }}
      />
    </Card>
  );
}
