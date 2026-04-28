import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { analyze, parseCoeffs } from '../../utils/pumpFlowCalibration.js';
import { fetchAndParseShot, fetchShotIndex, postCoefficients } from './api.js';
import {
  MODE_BREW,
  PHASE,
  POST_MODE_SETTLE_MS,
  POST_SHOT_SETTLE_MS,
  SHOT_END_TIMEOUT_MS,
} from './constants.js';
import { CALIBRATION_PROFILE, CALIBRATION_PROFILE_ID } from './profile.js';

/**
 * usePumpFlowCalibration
 * Drives the pump-flow calibration flow against a connected GaggiMate over
 * the existing ApiService WebSocket. Owns the full state machine
 * (idle → running → analyzing → done | error) plus the eventual save back
 * to /api/settings; the consuming component only needs to render.
 *
 * @param {object} opts
 * @param {string} opts.currentCoeffs - Current `pumpModelCoeffs` value, format "X,Y".
 * @param {(newCoeffs: string) => void} [opts.onApplied] - Called after a successful save.
 *
 * Returns:
 * - phase: PHASE — current state (use the exported PHASE enum to compare)
 * - logs: Array<{ key, msg, tone }> — append-only progress log
 * - results: { oneBar, nineBar, newCoeffs } | null — populated when phase is DONE
 * - saving: boolean — true while POST /api/settings is in flight
 * - saved: boolean — true after a successful save
 * - busy: boolean — convenience: phase === RUNNING || ANALYZING
 * - start: () => Promise<void> — kick off a calibration run
 * - apply: () => Promise<void> — write `results.newCoeffs` to the machine
 * - reset: () => void — return to IDLE and clear logs/results
 */
export function usePumpFlowCalibration({ currentCoeffs, onApplied }) {
  const apiService = useContext(ApiServiceContext);

  const [phase, setPhase] = useState(PHASE.IDLE);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const statusListenerRef = useRef(null);

  const detachStatusListener = useCallback(() => {
    if (statusListenerRef.current !== null) {
      apiService.off('evt:status', statusListenerRef.current);
      statusListenerRef.current = null;
    }
  }, [apiService]);

  // Always release the WS listener if the consumer unmounts mid-run.
  useEffect(() => detachStatusListener, [detachStatusListener]);

  const pushLog = useCallback((msg, tone = 'info') => {
    setLogs(prev => [...prev, { key: prev.length, msg, tone }]);
  }, []);

  const reset = useCallback(() => {
    detachStatusListener();
    setPhase(PHASE.IDLE);
    setLogs([]);
    setResults(null);
    setSaving(false);
    setSaved(false);
  }, [detachStatusListener]);

  const waitForShotEnd = useCallback(
    () =>
      new Promise((resolve, reject) => {
        let sawActive = false;
        const safetyId = setTimeout(() => {
          detachStatusListener();
          reject(new Error('Timeout waiting for shot to finish (5min).'));
        }, SHOT_END_TIMEOUT_MS);
        statusListenerRef.current = apiService.on('evt:status', m => {
          const active = m.process?.a === 1;
          if (active) sawActive = true;
          if (sawActive && !active) {
            clearTimeout(safetyId);
            detachStatusListener();
            resolve();
          }
        });
      }),
    [apiService, detachStatusListener],
  );

  const start = useCallback(async () => {
    if (!apiService) {
      pushLog('Internal error: ApiService unavailable.', 'err');
      setPhase(PHASE.ERROR);
      return;
    }
    setLogs([]);
    setResults(null);
    setSaved(false);
    setPhase(PHASE.RUNNING);

    // Snapshot the profile that was active before we hijack it for calibration,
    // so we can restore it in the `finally` block. Skip if the user was already
    // sitting on the calibration profile (interrupted previous run).
    const previousProfileId = machine.value.status.selectedProfileId;
    const profileToRestore =
      previousProfileId && previousProfileId !== CALIBRATION_PROFILE_ID ? previousProfileId : null;

    try {
      // Validate the existing coefficients first so a malformed value can't
      // waste a full calibration shot (water + scale + portafilter).
      const [c1, c9] = parseCoeffs(currentCoeffs);

      pushLog('Saving calibration profile...');
      await apiService.request({ tp: 'req:profiles:save', profile: CALIBRATION_PROFILE });

      pushLog('Selecting calibration profile...');
      await apiService.request({ tp: 'req:profiles:select', id: CALIBRATION_PROFILE_ID });

      pushLog('Switching to BREW mode...');
      apiService.send({ tp: 'req:change-mode', mode: MODE_BREW });
      await new Promise(r => setTimeout(r, POST_MODE_SETTLE_MS));

      pushLog('Snapshotting shot history...');
      const before = await fetchShotIndex();
      const preIds = new Set(before.map(e => e.id));

      pushLog('Starting shot — adjust the steam valve to reach 1 bar, then 9 bar.', 'ok');
      // Subscribe to evt:status BEFORE activating so a fast a:0→1→0 transition
      // (or a status arriving in the same tick) can't slip past the listener.
      const shotEnd = waitForShotEnd();
      apiService.send({ tp: 'req:process:activate' });
      await shotEnd;

      pushLog('Shot finished. Fetching history...', 'ok');
      await new Promise(r => setTimeout(r, POST_SHOT_SETTLE_MS));
      const after = await fetchShotIndex();
      const fresh = after.filter(e => !preIds.has(e.id)).sort((a, b) => b.timestamp - a.timestamp);
      if (!fresh.length) {
        throw new Error('New shot did not appear in history — was it cancelled?');
      }

      const shotId = fresh[0].id;
      pushLog(`Downloading shot #${shotId}`);
      setPhase(PHASE.ANALYZING);

      const shot = await fetchAndParseShot(shotId, msg => pushLog(msg, 'warn'));
      pushLog(`Parsed ${shot.samples.length} samples (v${shot.version}).`);

      const oneBar = analyze(shot.samples, 1);
      const nineBar = analyze(shot.samples, 9);
      const newCoeffs = `${(c1 * oneBar.factor).toFixed(3)},${(c9 * nineBar.factor).toFixed(3)}`;
      setResults({ oneBar, nineBar, newCoeffs });

      pushLog('Analysis complete.', 'ok');
      setPhase(PHASE.DONE);
    } catch (err) {
      detachStatusListener();
      pushLog(`Error: ${err.message}`, 'err');
      setPhase(PHASE.ERROR);
    } finally {
      // Best-effort cleanup: put the user back on their previous profile and
      // remove the calibration profile from the machine. Failures here are
      // surfaced as warnings — they don't undo a successful calibration.
      if (profileToRestore) {
        try {
          pushLog('Restoring previous profile...');
          await apiService.request({ tp: 'req:profiles:select', id: profileToRestore });
        } catch (e) {
          pushLog(`Could not restore previous profile: ${e.message}`, 'warn');
        }
      }
      try {
        pushLog('Removing calibration profile...');
        await apiService.request({ tp: 'req:profiles:delete', id: CALIBRATION_PROFILE_ID });
      } catch (e) {
        pushLog(`Could not delete calibration profile: ${e.message}`, 'warn');
      }
    }
  }, [apiService, currentCoeffs, detachStatusListener, pushLog, waitForShotEnd]);

  const apply = useCallback(async () => {
    if (!results) return;
    setSaving(true);
    try {
      await postCoefficients(results.newCoeffs);
      pushLog(`Coefficients saved to machine: ${results.newCoeffs}`, 'ok');
      setSaved(true);
      onApplied?.(results.newCoeffs);
    } catch (err) {
      pushLog(`Save failed: ${err.message}`, 'err');
    } finally {
      setSaving(false);
    }
  }, [results, pushLog, onApplied]);

  const busy = phase === PHASE.RUNNING || phase === PHASE.ANALYZING;

  return { phase, logs, results, saving, saved, busy, start, apply, reset };
}
