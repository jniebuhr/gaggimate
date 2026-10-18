import { isApp } from '../app/platform.js';

function anchorDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';

  document.body.appendChild(a);
  setTimeout(() => {
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 10);
}

// In the native app the share sheet replaces downloads; older app builds without the plugins fall back.
async function appDownload(files) {
  try {
    const { shareFiles } = await import('../app/shareFiles.js');
    if (await shareFiles(files)) return;
  } catch (err) {
    console.error('Sharing export failed', err);
    return;
  }
  files.forEach(({ blob, filename }) => anchorDownload(blob, filename));
}

export function downloadBlob(blob, filename) {
  if (isApp) return appDownload([{ blob, filename }]);
  anchorDownload(blob, filename);
  return Promise.resolve();
}

function jsonBlob(json) {
  return new Blob([JSON.stringify(json, undefined, 2)], { type: 'application/json' });
}

export function downloadJson(json, filename) {
  return downloadBlob(jsonBlob(json), filename);
}

export async function downloadJsonQueue(files, delayMs = 500) {
  if (isApp) {
    await appDownload(files.map(file => ({ blob: jsonBlob(file.json), filename: file.filename })));
    return;
  }
  for (const [index, file] of files.entries()) {
    downloadJson(file.json, file.filename);
    if (index < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
