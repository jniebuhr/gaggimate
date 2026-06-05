import { archiveValidationService } from './ArchiveValidationService.js';
import { archiveHealthService } from './ArchiveHealthService.js';

class ArchiveImportValidationService {
  parseJsonContainer(content) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;

      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      return {
        success: false,
        error: `Invalid archive format: ${error.message}`,
      };
    }
  }

  buildBundleFromContainer(container) {
    const files = container?.files || {};

    return {
      manifest: container?.manifest,
      integrity: JSON.parse(files['metadata/integrity.json'] || '{}'),
      payload: {
        shots: JSON.parse(files['shots/shots.json'] || '[]'),
        profiles: JSON.parse(files['profiles/profiles.json'] || '[]'),
        notes: JSON.parse(files['notes/notes.json'] || '[]'),
        metadata: JSON.parse(files['metadata/metadata.json'] || '{}'),
      },
    };
  }

  async validateImportContainer(content) {
    const parsed = this.parseJsonContainer(content);

    if (!parsed.success) {
      return {
        validation: {
          status: 'Critical',
          reason: parsed.error,
        },
        health: {
          status: 'Critical',
          reason: parsed.error,
        },
        canImport: false,
      };
    }

    const bundle = this.buildBundleFromContainer(parsed.data);

    const validation = await archiveValidationService.validatePreparedBundle(bundle);
    const health = archiveHealthService.evaluate(validation, bundle.manifest);

    return {
      validation,
      health,
      canImport: validation.status !== 'Critical' && health.status !== 'Critical',
      manifest: bundle.manifest,
      counts: bundle.manifest?.counts || null,
    };
  }
}

export const archiveImportValidationService = new ArchiveImportValidationService();
