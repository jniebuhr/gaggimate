import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@lingui/core/macro';
import { downloadJson } from '../../../../utils/download';
import { libraryService } from '../../services/LibraryService';
import { getShotStorageKey } from '../../utils/analyzerUtils';

async function processShotList({ targets, deleting, operation, completed, onProgress }) {
  let failed = 0;
  for (const item of targets) {
    if (operation.cancelled) break;
    try {
      const task = deleting
        ? libraryService.deleteShot(getShotStorageKey(item))
        : libraryService.exportItem(item, true);
      const result = await task; // NOSONAR -- Keep device operations sequential.
      completed.push(deleting ? String(item.id) : result.exportData);
    } catch {
      failed += 1;
    }
    if (operation.cancelled) break;
    onProgress({ current: completed.length + failed, total: targets.length, deleting });
  }
  return failed;
}

function reportFailedShots({ deleting, failed, count, completed, cancelled }) {
  if (cancelled || failed === 0) return;
  alert(
    deleting
      ? t`Could not delete ${failed} of ${count} shots.`
      : t`Exported ${completed.length} of ${count} shots (${failed} failed).`,
  );
}

/** One sequential bulk operation shared by the entry list and library. */
export function useShotListActions({ shots, refreshShots, onShotsDeleted }) {
  const [progress, setProgress] = useState(null);
  const operationRef = useRef(null);
  const mountedRef = useRef(true);

  const cancel = () => {
    if (operationRef.current) operationRef.current.cancelled = true;
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, []);

  const run = async deleting => {
    if (operationRef.current || shots.length === 0) return;
    const targets = [...shots];
    const count = targets.length;
    if (
      !confirm(
        deleting
          ? t`WARNING: Do you really want to IRREVOCABLY delete all ${count} filtered shots?`
          : t`Export all ${count} filtered shots to one JSON file?`,
      )
    )
      return;

    const operation = { cancelled: false };
    operationRef.current = operation;
    const completed = [];
    setProgress({ current: 0, total: count, deleting });
    try {
      const failed = await processShotList({
        targets,
        deleting,
        operation,
        completed,
        onProgress: setProgress,
      });
      if (!deleting && !operation.cancelled && completed.length > 0) {
        const exportedAt = new Date().toISOString();
        await downloadJson(
          { exportedAt, count: completed.length, shots: completed },
          `shot-history-export-${exportedAt.slice(0, 10)}.json`,
        );
      }
      reportFailedShots({
        deleting,
        failed,
        count,
        completed,
        cancelled: operation.cancelled,
      });
    } catch (error) {
      const message = error.message;
      alert(t`Export failed: ${message}`);
    } finally {
      if (deleting && mountedRef.current) {
        onShotsDeleted?.(completed);
        await refreshShots();
      }
      if (operationRef.current === operation) {
        operationRef.current = null;
        if (mountedRef.current) setProgress(null);
      }
    }
  };

  return {
    progress,
    busy: Boolean(progress),
    cancel,
    exportAllShots: () => run(false),
    deleteAllShots: () => run(true),
  };
}
