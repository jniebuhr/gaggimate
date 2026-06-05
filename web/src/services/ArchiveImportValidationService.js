import { archiveValidationService } from './ArchiveValidationService.js';
import { archiveHealthService } from './ArchiveHealthService.js';
import { archiveZipImportService } from './ArchiveZipImportService.js';

class ArchiveImportValidationService {
  async buildBundleFromArchive(input) {
    return archiveZipImportService.readZipArchive(input);
  }

  async validateImportArchive(input) {
    let bundle;

    try {
      bundle = await this.buildBundleFromArchive(input);
    } catch (error) {
      return {
        validation: {
          status: 'Critical',
          reason: `Invalid archive format: ${error.message}`,
        },
        health: {
          status: 'Critical',
          reason: `Invalid archive format: ${error.message}`,
        },
        canImport: false,
        manifest: null,
        counts: null,
      };
    }

    const validation = await archiveValidationService.validatePreparedBundle(bundle);
    const health = archiveHealthService.evaluate(validation, bundle.manifest);

    return {
      validation,
      health,
      canImport: validation.status !== 'Critical' && health.status !== 'Critical',
      manifest: bundle.manifest,
      counts: bundle.manifest?.counts || null,
      bundle,
    };
  }
}

export const archiveImportValidationService = new ArchiveImportValidationService();
