import JSZip from 'jszip';
import { archiveExportService } from './ArchiveExportService.js';

class ArchiveZipService {
  async buildZipArchive(options = {}) {
    const prepared = await archiveExportService.prepareExport(options);

    if (!prepared.canExport) {
      return {
        success: false,
        reason: prepared.validation.reason || prepared.health.reason,
        validation: prepared.validation,
        health: prepared.health,
      };
    }

    const zip = new JSZip();

    Object.entries(prepared.files).forEach(([path, content]) => {
      zip.file(path, content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });

    return {
      success: true,
      filename: prepared.bundleName,
      mimeType: 'application/zip',
      blob,
      manifest: prepared.manifest,
      validation: prepared.validation,
      health: prepared.health,
    };
  }
}

export const archiveZipService = new ArchiveZipService();
