const SUPPORTED_SCHEMA_VERSION = 1;
const REQUIRED_MANIFEST_FIELDS = [
  'archiveVersion',
  'schemaVersion',
  'bundleType',
  'bundleName',
  'createdAt',
  'counts',
  'source',
  'storageMetrics',
  'integrity',
];

function stableJson(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableJson(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(content) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA256 validation requires crypto.subtle support');
  }

  const encoded = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(digest);
}

function good(reason = 'Archive validation passed') {
  return {
    status: 'Good',
    reason,
    recommendedAction: 'Archive can be used.',
  };
}

function warning(reason, recommendedAction = 'Review warnings before using this archive.') {
  return {
    status: 'Warning',
    reason,
    recommendedAction,
  };
}

function critical(reason, recommendedAction = 'Do not import this archive. Use another backup if available.') {
  return {
    status: 'Critical',
    reason,
    recommendedAction,
  };
}

class ArchiveValidationService {
  async validatePreparedBundle(bundle) {
    const manifestResult = this.validateManifest(bundle?.manifest);
    if (manifestResult.status === 'Critical') {
      return manifestResult;
    }

    const countsResult = this.validateCounts(bundle?.manifest, bundle?.payload);
    if (countsResult.status === 'Critical') {
      return countsResult;
    }

    const integrityResult = await this.validateIntegrity(bundle?.manifest, bundle?.payload);
    if (integrityResult.status === 'Critical') {
      return integrityResult;
    }

    if (manifestResult.status === 'Warning') return manifestResult;
    if (countsResult.status === 'Warning') return countsResult;
    if (integrityResult.status === 'Warning') return integrityResult;

    return good();
  }

  validateManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') {
      return critical('Archive manifest is missing or invalid.');
    }

    const missingFields = REQUIRED_MANIFEST_FIELDS.filter(field => !(field in manifest));
    if (missingFields.length > 0) {
      return critical(`Archive manifest is missing required fields: ${missingFields.join(', ')}.`);
    }

    if (manifest.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
      return critical(
        `Archive schema version ${manifest.schemaVersion} is newer than supported version ${SUPPORTED_SCHEMA_VERSION}.`,
        'Update GaggiGo before importing this archive.',
      );
    }

    if (manifest.schemaVersion < SUPPORTED_SCHEMA_VERSION) {
      return warning(
        `Archive uses older supported schema version ${manifest.schemaVersion}.`,
        'Import is supported. Re-export using the latest version when convenient.',
      );
    }

    if (manifest.integrity?.algorithm !== 'SHA-256') {
      return critical('Archive integrity algorithm is missing or unsupported.');
    }

    return good('Archive manifest is valid.');
  }

  validateCounts(manifest, payload) {
    const counts = manifest?.counts;
    const shots = payload?.shots;
    const profiles = payload?.profiles;
    const notes = payload?.notes;

    if (!counts || !Array.isArray(shots) || !Array.isArray(profiles) || !Array.isArray(notes)) {
      return critical('Archive payload sections are missing or invalid.');
    }

    const mismatches = [];
    if (counts.shots !== shots.length) mismatches.push(`shots expected ${counts.shots}, found ${shots.length}`);
    if (counts.profiles !== profiles.length) mismatches.push(`profiles expected ${counts.profiles}, found ${profiles.length}`);
    if (counts.notes !== notes.length) mismatches.push(`notes expected ${counts.notes}, found ${notes.length}`);

    if (mismatches.length > 0) {
      return critical(`Archive manifest counts do not match payload: ${mismatches.join('; ')}.`);
    }

    return good('Archive counts match payload sections.');
  }

  async validateIntegrity(manifest, payload) {
    const integrity = manifest?.integrity;
    const sections = integrity?.sections;

    if (!integrity || !sections) {
      return critical('Archive integrity section is missing.');
    }

    const expected = {
      shots: await sha256(stableJson(payload.shots)),
      profiles: await sha256(stableJson(payload.profiles)),
      notes: await sha256(stableJson(payload.notes)),
      metadata: await sha256(stableJson(payload.metadata)),
      overall: await sha256(stableJson(payload)),
    };

    const failures = [];
    if (sections.shots !== expected.shots) failures.push('shots');
    if (sections.profiles !== expected.profiles) failures.push('profiles');
    if (sections.notes !== expected.notes) failures.push('notes');
    if (sections.metadata !== expected.metadata) failures.push('metadata');
    if (integrity.overall !== expected.overall) failures.push('overall');

    if (failures.length > 0) {
      return critical(`Archive integrity check failed for: ${failures.join(', ')}.`);
    }

    return good('Archive integrity verified.');
  }
}

export const archiveValidationService = new ArchiveValidationService();
