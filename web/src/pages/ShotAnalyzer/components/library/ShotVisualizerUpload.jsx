import { useState } from 'preact/hooks';
import { t } from '@lingui/core/macro';
import VisualizerUploadModal from '../../../../components/VisualizerUploadModal';
import { visualizerService } from '../../../../services/VisualizerService';
import { libraryService } from '../../services/LibraryService';

export function ShotVisualizerUpload({ shot, onClose }) {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (username, password) => {
    setIsUploading(true);
    try {
      const { exportData } = await libraryService.exportItem(shot, true);
      if (!visualizerService.validateShot(exportData)) {
        throw new Error(t`Shot data is invalid or incomplete`);
      }
      let profile = null;
      if (exportData.profileId) {
        try {
          profile = await libraryService.loadProfile(exportData.profileId);
        } catch (error) {
          console.warn('Failed to fetch profile data:', error);
        }
      }
      await visualizerService.uploadShot(exportData, username, password, profile);
      alert(t`Shot uploaded successfully to visualizer.coffee!`);
    } catch (error) {
      const errorMessage = error.message;
      alert(t`Upload failed: ${errorMessage}`);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <VisualizerUploadModal
      isOpen
      onClose={onClose}
      onUpload={upload}
      isUploading={isUploading}
      shotInfo={shot}
    />
  );
}
