from pathlib import Path

path = Path("web/src/pages/Storage/index.jsx")
text = path.read_text(encoding="utf-8")

required = [
    "import { archiveImportService } from '../../services/ArchiveImportService.js';",
    "const [restorePreview, setRestorePreview] = useState(null);",
    "const [restoreLoading, setRestoreLoading] = useState(false);",
    "const [restoreError, setRestoreError] = useState('');",
    "const file = event.currentTarget.files?.[0];",
    "Backup has been validated. Import execution is not enabled yet.",
    "disabled={restoreLoading}",
]

for marker in required:
    if marker not in text:
        raise SystemExit(f"Missing expected marker, aborting: {marker}")

text = text.replace(
    "import { archiveImportService } from '../../services/ArchiveImportService.js';",
    "import { archiveImportService } from '../../services/ArchiveImportService.js';\n"
    "import { archiveExecutionService } from '../../services/ArchiveExecutionService.js';",
    1,
)

text = text.replace(
    "  const [restorePreview, setRestorePreview] = useState(null);\n"
    "  const [restoreLoading, setRestoreLoading] = useState(false);\n"
    "  const [restoreError, setRestoreError] = useState('');",
    "  const [restoreFile, setRestoreFile] = useState(null);\n"
    "  const [restorePreview, setRestorePreview] = useState(null);\n"
    "  const [restoreLoading, setRestoreLoading] = useState(false);\n"
    "  const [restoreExecuting, setRestoreExecuting] = useState(false);\n"
    "  const [restoreResult, setRestoreResult] = useState(null);\n"
    "  const [restoreError, setRestoreError] = useState('');",
    1,
)

text = text.replace(
    "    setRestorePreview(null);\n"
    "    setRestoreError('');\n"
    "    setRestoreLoading(true);",
    "    setRestoreFile(file);\n"
    "    setRestorePreview(null);\n"
    "    setRestoreResult(null);\n"
    "    setRestoreError('');\n"
    "    setRestoreLoading(true);",
    1,
)

text = text.replace(
    "      console.error('Failed to preview restore backup', error);\n"
    "      setRestoreError(`Backup could not be read. ${error?.message || 'Unknown restore preview error'}`);",
    "      console.error('Failed to preview restore backup', error);\n"
    "      setRestoreFile(null);\n"
    "      setRestoreError(`Backup could not be read. ${error?.message || 'Unknown restore preview error'}`);",
    1,
)

text = text.replace(
    "  const restoreShotSummary = restorePreview?.summary?.shots || {};\n\n"
    "  return (",
    "  const restoreShotSummary = restorePreview?.summary?.shots || {};\n\n"
    "  async function executeRestoreBackup() {\n"
    "    if (!restoreFile || !restorePreview?.canImport) return;\n\n"
    "    setRestoreExecuting(true);\n"
    "    setRestoreResult(null);\n"
    "    setRestoreError('');\n\n"
    "    try {\n"
    "      const result = await archiveExecutionService.executeImport(restoreFile);\n"
    "      setRestoreResult(result);\n\n"
    "      if (!result.success) {\n"
    "        setRestoreError(result.reason || 'Restore completed with errors. Review the restore result.');\n"
    "      }\n"
    "    } catch (error) {\n"
    "      console.error('Failed to restore backup', error);\n"
    "      setRestoreError('Backup could not be restored. ' + (error?.message || 'Unknown restore error'));\n"
    "    } finally {\n"
    "      setRestoreExecuting(false);\n"
    "    }\n"
    "  }\n\n"
    "  return (",
    1,
)

text = text.replace(
    "                  disabled={restoreLoading}",
    "                  disabled={restoreLoading || restoreExecuting}",
    1,
)

text = text.replace(
    "                      Backup has been validated. Import execution is not enabled yet.",
    "                      Existing data is preserved. Duplicate shots are skipped and profiles are restored as copies.",
    1,
)

text = text.replace(
    "                {restorePreview.health?.reason && (\n"
    "                  <p className='text-base-content/60 mt-1 text-sm'>Health: {restorePreview.health.reason}</p>\n"
    "                )}\n"
    "              </div>",
    "                {restorePreview.health?.reason && (\n"
    "                  <p className='text-base-content/60 mt-1 text-sm'>Health: {restorePreview.health.reason}</p>\n"
    "                )}\n\n"
    "                {restorePreview.canImport && !restoreResult && (\n"
    "                  <div className='card-actions mt-5 justify-end'>\n"
    "                    <button\n"
    "                      type='button'\n"
    "                      className='btn btn-primary w-full sm:w-auto'\n"
    "                      onClick={executeRestoreBackup}\n"
    "                      disabled={restoreExecuting}\n"
    "                    >\n"
    "                      {restoreExecuting ? 'Restoring Backup' : 'Restore Backup'}\n"
    "                    </button>\n"
    "                  </div>\n"
    "                )}\n\n"
    "                {restoreResult && (\n"
    "                  <div className={`alert mt-4 text-sm ${restoreResult.success ? 'alert-success' : 'alert-warning'}`}>\n"
    "                    Restore complete. Imported {countLabel(restoreResult.imported?.shots || 0)} shots, {countLabel(restoreResult.imported?.profiles || 0)} profiles, and {countLabel(restoreResult.imported?.notes || 0)} notes. Skipped {countLabel(restoreResult.skipped?.shots || 0)} duplicate shots.\n"
    "                  </div>\n"
    "                )}\n"
    "              </div>",
    1,
)

post_required = [
    "archiveExecutionService.executeImport(restoreFile)",
    "const [restoreFile, setRestoreFile] = useState(null);",
    "const [restoreExecuting, setRestoreExecuting] = useState(false);",
    "const [restoreResult, setRestoreResult] = useState(null);",
    "Restoring Backup",
    "Restore complete. Imported",
]

for marker in post_required:
    if marker not in text:
        raise SystemExit(f"Patch verification failed, missing: {marker}")

if "Backup could not be restored. " not in text:
    raise SystemExit("Patch verification failed: restore error text missing")

path.write_text(text, encoding="utf-8", newline="\n")
print("Restore execution patch applied and self-verified.")
