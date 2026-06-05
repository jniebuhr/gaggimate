function buildResult(status, reason, recommendedAction) {
  return {
    status,
    reason,
    recommendedAction,
    evaluatedAt: new Date().toISOString(),
  };
}

export class ArchiveHealthService {
  evaluate(validationResult, manifest = {}) {
    if (!validationResult) {
      return buildResult(
        'Critical',
        'Archive validation result is missing.',
        'Validate the archive before use.',
      );
    }

    if (validationResult.status === 'Critical') {
      return buildResult(
        'Critical',
        validationResult.reason,
        validationResult.recommendedAction,
      );
    }

    if (validationResult.status === 'Warning') {
      return buildResult(
        'Warning',
        validationResult.reason,
        validationResult.recommendedAction,
      );
    }

    const createdAt = manifest.createdAt ? new Date(manifest.createdAt) : null;

    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);

      if (ageDays > 365 * 2) {
        return buildResult(
          'Warning',
          'Archive is more than two years old.',
          'Import is supported. Consider re-exporting using the latest archive format.',
        );
      }
    }

    return buildResult(
      'Good',
      'Archive validated successfully and no health concerns were detected.',
      'Archive can be imported or retained as a backup.',
    );
  }
}

export const archiveHealthService = new ArchiveHealthService();
