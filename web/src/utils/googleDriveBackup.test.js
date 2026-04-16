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
      try {
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }) => {
                callback({ access_token: 'fake-access-token', expires_in: 3600 });
              },
            },
          },
        };
        window.fetch = async () => ({
          ok: true,
          json: async () => ({ files: [] }),
        });

        const provider = createGoogleDriveProvider({ clientId: 'test' });
        const result = await provider.listBackups();
        expect(result).toEqual([]);
      } finally {
        window.fetch = originalFetch;
        delete window.google;
      }
    });

    it('returns mapped files with fileId, modifiedTime, size', async () => {
      const originalFetch = window.fetch;
      try {
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }) => {
                callback({ access_token: 'fake-access-token', expires_in: 3600 });
              },
            },
          },
        };
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
      } finally {
        window.fetch = originalFetch;
        delete window.google;
      }
    });
  });

  describe('uploadBackup', () => {
    it('uploads bundle and returns fileId and modifiedTime', async () => {
      const originalFetch = window.fetch;
      try {
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }) => {
                callback({ access_token: 'fake-access-token', expires_in: 3600 });
              },
            },
          },
        };
        window.fetch = async () => ({
          ok: true,
          json: async () => ({ id: 'uploaded-file-id', modifiedTime: '2025-01-01T00:00:00Z' }),
        });
        const provider = createGoogleDriveProvider({ clientId: 'test' });
        const bundle = { type: 'gaggimate-backup', version: 2 };
        const result = await provider.uploadBackup(bundle);
        expect(result.fileId).toBe('uploaded-file-id');
        expect(result.modifiedTime).toBe('2025-01-01T00:00:00Z');
      } finally {
        window.fetch = originalFetch;
        delete window.google;
      }
    });

    it('throws when upload does not return a file ID', async () => {
      const originalFetch = window.fetch;
      try {
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }) => {
                callback({ access_token: 'fake-access-token', expires_in: 3600 });
              },
            },
          },
        };
        window.fetch = async () => ({
          ok: true,
          json: async () => ({}),
        });
        const provider = createGoogleDriveProvider({ clientId: 'test' });
        const bundle = { type: 'gaggimate-backup', version: 2 };
        let threw = false;
        try {
          await provider.uploadBackup(bundle);
        } catch (e) {
          threw = true;
          expect(e.message).toBe('Upload succeeded but did not return a file ID.');
        }
        expect(threw).toBe(true);
      } finally {
        window.fetch = originalFetch;
        delete window.google;
      }
    });
  });

  describe('downloadBackup', () => {
    it('downloads and parses backup content for given fileId', async () => {
      const originalFetch = window.fetch;
      try {
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }) => {
                callback({ access_token: 'fake-access-token', expires_in: 3600 });
              },
            },
          },
        };
        const mockBundle = { type: 'gaggimate-backup', version: 2, settings: {} };
        window.fetch = async () => ({
          ok: true,
          json: async () => mockBundle,
        });
        const provider = createGoogleDriveProvider({ clientId: 'test' });
        const result = await provider.downloadBackup('file-id-123');
        expect(result).toEqual(mockBundle);
      } finally {
        window.fetch = originalFetch;
        delete window.google;
      }
    });
  });

});