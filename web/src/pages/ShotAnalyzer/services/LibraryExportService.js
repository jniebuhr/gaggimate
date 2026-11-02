import { downloadJson, downloadJsonQueue } from '../../../utils/download';
import { libraryService } from './LibraryService';

export async function exportLibraryItems(items) {
  const exports = await Promise.all(
    items.map(({ item, isShot }) => libraryService.exportItem(item, isShot)),
  );
  const files = exports.map(({ exportData, filename }) => ({ json: exportData, filename }));

  if (files.length > 1) {
    await downloadJsonQueue(files);
  } else if (files[0]) {
    downloadJson(files[0].json, files[0].filename);
  }
}
