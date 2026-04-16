const GOOGLE_CLIENT_ID_KEY = 'gaggimate-google-drive-client-id';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'gaggimate-backup.json';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

const ERROR_MESSAGES = {
  'access_denied': 'Access to Google Drive was denied. Please try again and authorize.',
  'popup_closed': 'Sign-in window was closed before completing authorization.',
  'network': 'Network error. Check your connection and try again.',
  'quota_exceeded': 'Google Drive storage quota exceeded. Free up space and try again.',
  'idpiframe_initialization_failed': 'Google sign-in is not available in this browser.',
};

let gisScriptPromise = null;
let accessToken = '';
let accessTokenExpiryMs = 0;

/**
 * Clears locally-cached access token. The GIS token client's internal
 * state is unaffected -- the next requestAccessToken call will detect
 * the empty token and trigger a fresh OAuth flow.
 */
function invalidateToken() {
  accessToken = '';
  accessTokenExpiryMs = 0;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

async function ensureGISLoaded() {
  if (!gisScriptPromise) {
    gisScriptPromise = loadScript(GIS_SCRIPT_URL);
  }
  await gisScriptPromise;
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services is unavailable.');
  }
}

function getValidAccessToken() {
  return accessToken && Date.now() < accessTokenExpiryMs ? accessToken : '';
}

async function requestAccessToken(clientId) {
  await ensureGISLoaded();

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: tokenResponse => {
        if (tokenResponse.error) {
          const friendly = ERROR_MESSAGES[tokenResponse.error] || tokenResponse.error || 'Google sign-in failed.';
          reject(new Error(friendly));
          return;
        }

        accessToken = tokenResponse.access_token;
        const expiresInMs = Number(tokenResponse.expires_in || 0) * 1000;
        accessTokenExpiryMs = Date.now() + Math.max(expiresInMs - 60_000, 0);
        resolve(accessToken);
      },
      error_callback: error => {
        const friendly = ERROR_MESSAGES[error?.message] || error?.message || 'Google sign-in failed.';
        reject(new Error(friendly));
      },
    });

    tokenClient.requestAccessToken({ prompt: getValidAccessToken() ? '' : 'consent' });
  });
}

async function authorizedFetch(clientId, url, options = {}) {
  let token = getValidAccessToken() || (await requestAccessToken(clientId));

  const doFetch = async (authToken, retried = false) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${authToken}`);
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !retried) {
      // Token revoked or expired server-side - force re-request
      invalidateToken();
      const newToken = await requestAccessToken(clientId);
      return doFetch(newToken, true);
    }
    return response;
  };

  const response = await doFetch(token);

  if (!response.ok) {
    let details = '';
    try {
      details = await response.text();
    } catch {
      details = '';
    }
    throw new Error(`Google Drive request failed (${response.status}). ${details}`.trim());
  }

  return response;
}

function buildMultipartBody(metadata, content) {
  const boundary = `gaggimate-${Date.now().toString(16)}`;
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n`,
    `--${boundary}--`,
  ].join('');

  return {
    boundary,
    body,
  };
}

export function getStoredGoogleDriveClientId() {
  try {
    return localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredGoogleDriveClientId(clientId) {
  try {
    localStorage.setItem(GOOGLE_CLIENT_ID_KEY, String(clientId || '').trim());
    return true;
  } catch {
    return false;
  }
}

async function listGoogleDriveBackups(clientId) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    q: `name='${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed=false`,
  });

  const response = await authorizedFetch(
    clientId,
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
  );
  const data = await response.json();
  return Array.isArray(data.files) ? data.files : [];
}

async function uploadGoogleDriveBackup(clientId, bundle) {
  const existingFiles = await listGoogleDriveBackups(clientId);
  const content = JSON.stringify(bundle, null, 2);
  const metadata = existingFiles[0]
    ? { name: BACKUP_FILENAME }
    : { name: BACKUP_FILENAME, parents: ['appDataFolder'] };
  const { boundary, body } = buildMultipartBody(metadata, content);

  const url = existingFiles[0]
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFiles[0].id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = existingFiles[0] ? 'PATCH' : 'POST';

  const response = await authorizedFetch(clientId, url, {
    method,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return response.json();
}

async function downloadGoogleDriveBackup(clientId, fileId) {
  const response = await authorizedFetch(
    clientId,
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  );
  return response.json();
}

/**
 * Creates a Google Drive cloud backup provider.
 * @param {{ clientId: string }} config
 * @returns {import('./cloudBackupManager').CloudBackupProvider}
 */
export function createGoogleDriveProvider({ clientId }) {
  return {
    providerId: 'google-drive',
    providerName: 'Google Drive',

    isConfigured() {
      return Boolean(clientId && clientId.trim().length > 0);
    },

    async listBackups() {
      const files = await listGoogleDriveBackups(clientId);
      return files.map(f => ({
        fileId: f.id,
        modifiedTime: f.modifiedTime,
        size: f.size,
      }));
    },

    async uploadBackup(bundle) {
      const result = await uploadGoogleDriveBackup(clientId, bundle);
      return {
        fileId: result.id,
        modifiedTime: result.modifiedTime,
      };
    },

    async downloadBackup(fileId) {
      return downloadGoogleDriveBackup(clientId, fileId);
    },
  };
}

export { BACKUP_FILENAME, GOOGLE_DRIVE_SCOPE };