import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ApiServiceContext, machine, updateSettingsCache } from '../../services/ApiService.js';
import { analyze, parseCoeffs } from '../../utils/pumpFlowCalibration.js';
import { activeWarnings, parseWarningStates } from '../../utils/warnings.js';
import { fetchAndParseShot, fetchShotIndex, postCoefficients } from './api.js';
import {
  MODE_BREW,
  PHASE,
  POST_MODE_SETTLE_MS,
  SHOT_END_TIMEOUT_MS,
  SHOT_SAVED_POLL_DELAY_MS,
  SHOT_SAVED_POLL_RETRIES,
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

  // WS listeners of the current run as [type, id] pairs.
  const listenersRef = useRef([]);
  // Shot id reported by evt:history-shot-saved plus a wake-up for the poll loop.
  const savedShotIdRef = useRef(null);
  const savedWakeRef = useRef(null);
  // Survives Retry, where the selected profile is already the calibration profile.
  const restoreProfileRef = useRef(null);
  // Prevents start() from running concurrently with itself: the Retry button
  // on the ERROR screen (or any other re-entry path) must not be allowed to
  // kick off a second run while the previous one's `finally` cleanup is still
  // awaiting profile-restore / profile-delete requests, since the second run
  // would clobber statusListenerRef and interleave WS calls.
  const inFlightRef = useRef(false);
  // Tracks the safety setTimeout and the pending Promise reject inside
  // waitForShotEnd so detachStatusListener can clear the timer and unblock an
  // awaiting start() instead of leaking a stale 5-min reject that fires into a
  // future run's state.
  const safetyIdRef = useRef(null);
  const waitRejectRef = useRef(null);

  const detachStatusListener = useCallback(() => {
    for (const [type, id] of listenersRef.current) apiService.off(type, id);
    listenersRef.current = [];
    savedWakeRef.current?.();
    if (safetyIdRef.current !== null) {
      clearTimeout(safetyIdRef.current);
      safetyIdRef.current = null;
    }
    if (waitRejectRef.current !== null) {
      const reject = waitRejectRef.current;
      waitRejectRef.current = null;
      reject(new Error('Calibration cancelled.'));
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

  const listen = useCallback(
    (type, handler) => listenersRef.current.push([type, apiService.on(type, handler)]),
    [apiService],
  );

  const waitForShotEnd = useCallback(
    () =>
      new Promise((resolve, reject) => {
        let sawActive = false;
        // The refs let detachStatusListener cancel cleanly: it clears the
        // safety timer and rejects this promise so an awaiting start()
        // unblocks instead of hanging until the 5-min timeout.
        waitRejectRef.current = reject;
        safetyIdRef.current = setTimeout(() => {
          // Mark as settled before detaching so detach doesn't double-reject.
          safetyIdRef.current = null;
          waitRejectRef.current = null;
          detachStatusListener();
          reject(new Error('Timeout waiting for shot to finish (5min).'));
        }, SHOT_END_TIMEOUT_MS);
        // Error-level warnings (e.g. still heating) park the start behind a confirmation only Home shows.
        listen('evt:brew:confirm', m => {
          const labels = activeWarnings(parseWarningStates(m.warn)).map(w => w.label);
          pushLog(`Starting despite warnings: ${labels.join(', ') || 'unknown'}`, 'warn');
          apiService.send({ tp: 'req:process:activate', ignoreWarnings: true });
        });
        listen('evt:brew:confirm:cancel', () => {
          waitRejectRef.current = null;
          detachStatusListener();
          reject(new Error('Shot start was cancelled on the machine.'));
        });
        listen('evt:status', m => {
          // State-only frames carry no process key; only telemetry frames say whether it's active.
          if (!Object.prototype.hasOwnProperty.call(m, 'process')) return;
          const active = m.process?.a === 1;
          if (active) sawActive = true;
          if (sawActive && !active) {
            // Listeners stay attached: the shot-saved event only arrives after this point.
            if (safetyIdRef.current !== null) {
              clearTimeout(safetyIdRef.current);
              safetyIdRef.current = null;
            }
            waitRejectRef.current = null;
            resolve();
          }
        });
      }),
    [apiService, detachStatusListener, listen, pushLog],
  );

  // The index entry lands after extended recording: take the saved event, poll index.bin as fallback.
  const waitForSavedShot = useCallback(async preIds => {
    for (let attempt = 1; attempt <= SHOT_SAVED_POLL_RETRIES; attempt++) {
      if (savedShotIdRef.current !== null) return savedShotIdRef.current;
      const index = await fetchShotIndex();
      const fresh = index.filter(e => !preIds.has(e.id)).sort((a, b) => b.timestamp - a.timestamp);
      if (fresh.length) return fresh[0].id;
      if (attempt === SHOT_SAVED_POLL_RETRIES) break;
      await new Promise(resolve => {
        const timer = setTimeout(resolve, SHOT_SAVED_POLL_DELAY_MS);
        savedWakeRef.current = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      savedWakeRef.current = null;
    }
    throw new Error('New shot did not appear in history — was it cancelled?');
  }, []);

  const start = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!apiService) {
      pushLog('Internal error: ApiService unavailable.', 'err');
      setPhase(PHASE.ERROR);
      return;
    }
    inFlightRef.current = true;
    setLogs([]);
    setResults(null);
    setSaved(false);
    setPhase(PHASE.RUNNING);

    // Snapshot the profile that was active before we hijack it for calibration,
    // so we can restore it in the `finally` block. Skip if the user was already
    // sitting on the calibration profile (interrupted previous run).
    const previousProfileId = machine.value.status.selectedProfileId;
    if (previousProfileId && previousProfileId !== CALIBRATION_PROFILE_ID) {
      restoreProfileRef.current = previousProfileId;
    }

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
      savedShotIdRef.current = null;
      listen('evt:history-shot-saved', m => {
        if (typeof m.id !== 'number' || preIds.has(m.id)) return;
        savedShotIdRef.current = m.id;
        savedWakeRef.current?.();
      });
      apiService.send({ tp: 'req:process:activate' });
      await shotEnd;

      pushLog('Shot finished. Waiting for it to be saved to history...', 'ok');
      const shotId = await waitForSavedShot(preIds);
      detachStatusListener();
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
      try {
        pushLog('Restoring previous profile...');
        let profileToRestore = restoreProfileRef.current;
        if (!profileToRestore) {
          // Never leave the machine on the profile we are about to delete.
          const list = await apiService.request({ tp: 'req:profiles:list', minimal: true });
          profileToRestore = list.profiles?.find(p => p.id !== CALIBRATION_PROFILE_ID)?.id;
        }
        if (profileToRestore) {
          await apiService.request({ tp: 'req:profiles:select', id: profileToRestore });
        } else {
          pushLog('No other profile found to switch back to.', 'warn');
        }
      } catch (e) {
        pushLog(`Could not restore previous profile: ${e.message}`, 'warn');
      }
      try {
        pushLog('Removing calibration profile...');
        await apiService.request({ tp: 'req:profiles:delete', id: CALIBRATION_PROFILE_ID });
      } catch (e) {
        pushLog(`Could not delete calibration profile: ${e.message}`, 'warn');
      }
      inFlightRef.current = false;
    }
  }, [
    apiService,
    currentCoeffs,
    detachStatusListener,
    listen,
    pushLog,
    waitForShotEnd,
    waitForSavedShot,
  ]);

  const apply = useCallback(async () => {
    if (!results) return;
    setSaving(true);
    try {
      updateSettingsCache(await postCoefficients(results.newCoeffs));
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
