import { t } from '@lingui/core/macro';

// App web views ignore <a download>, so exports are written to the cache and handed to the share sheet.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Resolves false when this native build predates the plugins, so the caller can fall back.
export async function shareFiles(files) {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isPluginAvailable('Filesystem') || !Capacitor.isPluginAvailable('Share')) {
    return false;
  }
  // Import inline; never return or await the plugin proxies themselves.
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const uris = [];
  for (const { blob, filename } of files) {
    const { uri } = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    uris.push(uri);
  }
  try {
    await Share.share({
      title: files.length === 1 ? files[0].filename : t`GaggiMate export`,
      files: uris,
    });
  } catch (err) {
    // Closing the share sheet rejects; that's not an error for the user.
    if (!/cancel/i.test(err?.message ?? '')) throw err;
  }
  return true;
}
