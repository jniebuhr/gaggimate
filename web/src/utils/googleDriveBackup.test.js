import { createGoogleDriveProvider } from './googleDriveBackup.js';

describe('GoogleDriveProvider', () => {

  describe('isConfigured', () => {
    it('returns false when clientId is empty', () => {
      const provider = createGoogleDriveProvider({ clientId: '' });
      expect(provider.isConfigured()).toBe(false);
    });

    it('returns false when clientId is only whitespace', () => {
      const provider = createGoogleDriveProvider({ clientId: '   ' });
      expect(provider.isConfigured()).toBe(false);
    });

    it('returns true when clientId is set', () => {
      const provider = createGoogleDriveProvider({ clientId: 'test-id-123' });
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('providerId and providerName', () => {
    it('has correct providerId', () => {
      const provider = createGoogleDriveProvider({ clientId: 'test' });
      expect(provider.providerId).toBe('google-drive');
    });

    it('has correct providerName', () => {
      const provider = createGoogleDriveProvider({ clientId: 'test' });
      expect(provider.providerName).toBe('Google Drive');
    });
  });

  describe('listBackups', () => {
    it('returns empty array when no files exist', async () => {
      const originalFetch = window.fetch;
      window.fetch = async () => ({
        ok: true,
        json: async () => ({ files: [] }),
      });

      const provider = createGoogleDriveProvider({ clientId: 'test' });
      const result = await provider.listBackups();
      expect(result).toEqual([]);

      window.fetch = originalFetch;
    });

    it('returns mapped files with fileId, modifiedTime, size', async () => {
      const originalFetch = window.fetch;
      const mockFiles = [
        { id: 'file-1', modifiedTime: '2025-01-01T00:00:00Z', size: 1234 },
        { id: 'file-2', modifiedTime: '2025-01-02T00:00:00Z', size: 5678 },
      ];
      window.fetch = async () => ({
        ok: true,
        json: async () => ({ files: mockFiles }),
      });

      const provider = createGoogleDriveProvider({ clientId: 'test' });
      const result = await provider.listBackups();

      expect(result).toEqual([
        { fileId: 'file-1', modifiedTime: '2025-01-01T00:00:00Z', size: 1234 },
        { fileId: 'file-2', modifiedTime: '2025-01-02T00:00:00Z', size: 5678 },
      ]);

      window.fetch = originalFetch;
    });
  });

});