import JSZip from 'jszip';

const REQUIRED_ARCHIVE_FILES = [
  'manifest.json',
  'shots/shots.json',
  'profiles/profiles.json',
  'notes/notes.json',
  'metadata/metadata.json',
  'metadata/integrity.json',
];

async function readJsonFile(zip, path) {
  const file = zip.file(path);

  if (!file) {
    throw new Error(`Archive is missing required file: ${path}`);
  }

  const content = await file.async('string');
  return JSON.parse(content);
}

class ArchiveZipImportService {
  async readZipArchive(input) {
    const zip = await JSZip.loadAsync(input);
    const missingFiles = REQUIRED_ARCHIVE_FILES.filter(path => !zip.file(path));

    if (missingFiles.length > 0) {
      throw new Error(`Archive ZIP is missing required files: ${missingFiles.join(', ')}`);
    }

    const [manifest, shots, profiles, notes, metadata, integrity] = await Promise.all([
      readJsonFile(zip, 'manifest.json'),
      readJsonFile(zip, 'shots/shots.json'),
      readJsonFile(zip, 'profiles/profiles.json'),
      readJsonFile(zip, 'notes/notes.json'),
      readJsonFile(zip, 'metadata/metadata.json'),
      readJsonFile(zip, 'metadata/integrity.json'),
    ]);

    return {
      manifest,
      integrity,
      payload: {
        shots,
        profiles,
        notes,
        metadata,
      },
    };
  }
}

export const archiveZipImportService = new ArchiveZipImportService();
