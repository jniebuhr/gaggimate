// web/src/utils/cloudBackupManager.js

import { createGoogleDriveProvider } from './googleDriveBackup.js';

/**
 * CloudBackupProvider interface contract:
 * - providerId: string
 * - providerName: string
 * - isConfigured(): boolean
 * - listBackups(): Promise<BackupMetadata[]>
 * - uploadBackup(bundle): Promise<BackupMetadata>
 * - downloadBackup(fileId): Promise<BackupBundle>
 */

export const CLOUD_PROVIDERS = {
  GOOGLE_DRIVE: 'google-drive',
};

export function createCloudBackupProvider(providerId, config) {
  switch (providerId) {
    case CLOUD_PROVIDERS.GOOGLE_DRIVE:
      return createGoogleDriveProvider(config);
    default:
      throw new Error(`Unknown cloud provider: ${providerId}`);
  }
}