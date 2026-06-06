import { archiveService } from './ArchiveService.js';
import { archiveValidationService } from './ArchiveValidationService.js';
import { archiveHealthService } from './ArchiveHealthService.js';

function toArchiveJson(value) {
  return JSON.stringify(value);
}

function toPrettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildArchiveFiles(bundle) {
  const { manifest, payload } = bundle;

  return {
    'manifest.json': toArchiveJson(manifest),
    'shots/shots.json': toArchiveJson(payload.shots),
    'profiles/profiles.json': toArchiveJson(payload.profiles),
    'notes/notes.json': toArchiveJson(payload.notes),
    'metadata/metadata.json': toArchiveJson(payload.metadata),
    'metadata/integrity.json': toArchiveJson(bundle.integrity),
  };
}

class ArchiveExportService {
  async prepareBundleForExport(bundle) {
    const validation = await archiveValidationService.validatePreparedBundle(bundle);
    const health = archiveHealthService.evaluate(validation, bundle.manifest);
    const files = buildArchiveFiles(bundle);

    return {
      bundleName: bundle.bundleName,
      manifest: bundle.manifest,
      validation,
      health,
      files,
      canExport: validation.status !== 'Critical' && health.status !== 'Critical',
    };
  }

  /**
   * Build a complete export-ready archive object from the current IndexedDB mirror.
   * This does not create a ZIP yet and does not trigger a browser download.
   */
  async prepareExport(options = {}) {
    const bundle = options.bundle || await archiveService.prepareArchiveBundle(options);
    return this.prepareBundleForExport(bundle);
  }

  /**
   * Serialise the archive structure into a single JSON container.
   * This is a temporary export transport until ZIP packaging is introduced.
   */
  async prepareJsonContainerExport(options = {}) {
    const prepared = await this.prepareExport(options);

    return {
      ...prepared,
      filename: prepared.bundleName.replace(/\.zip$/i, '.json'),
      mimeType: 'application/json',
      content: toPrettyJson({
        manifest: prepared.manifest,
        health: prepared.health,
        files: prepared.files,
      }),
    };
  }
}

export const archiveExportService = new ArchiveExportService();