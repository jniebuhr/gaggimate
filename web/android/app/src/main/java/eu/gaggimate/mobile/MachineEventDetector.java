package eu.gaggimate.mobile;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Java port of MachineMonitor (src/app/notifications.js); keep both in sync.
class MachineEventDetector {

    interface Listener {
        void onEvent(String event, String title, String body);
    }

    private static final int MODE_BREW = 1;
    private static final int MODE_STEAM = 2;
    private static final double HEATING_BAND = 3;
    private static final double READY_BAND = 1;
    private static final long STEAM_LEFT_ON_MS = 5 * 60 * 1000;
    private static final int WARNING_ERROR = 2;

    private final Map<String, String> warningLabels;
    private final Listener listener;
    // evt:status frames are partial; this holds the merged view.
    private final JSONObject status = new JSONObject();
    private Snapshot previous;
    private boolean heating = false;
    private Long steamSince = null;
    private boolean steamNotified = false;

    MachineEventDetector(Map<String, String> warningLabels, Listener listener) {
        this.warningLabels = warningLabels;
        this.listener = listener;
    }

    // A new connection starts from a fresh snapshot, like the web UI does.
    void reset() {
        Iterator<String> keys = status.keys();
        while (keys.hasNext()) {
            keys.next();
            keys.remove();
        }
        previous = null;
        heating = false;
        steamSince = null;
        steamNotified = false;
    }

    void onFrame(JSONObject frame, long now) {
        Iterator<String> keys = frame.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            if (frame.isNull(key)) {
                status.remove(key);
                continue;
            }
            try {
                status.put(key, frame.opt(key));
            } catch (JSONException ignored) {
                // Only thrown for NaN/infinite numbers, which the firmware never sends.
            }
        }
        Snapshot current = new Snapshot(status);
        Snapshot last = previous;
        previous = current;
        trackPreheat(current, last != null);
        trackSteam(current, now);
        // The first frame is a snapshot of whatever state the machine is already in, not a change.
        if (last == null) return;

        if (current.shotActive && !last.shotActive) {
            String phase = current.process != null ? current.process.optString("l", "") : "";
            listener.onEvent("shotStarted", "Shot started", phase.isEmpty() ? "Brewing…" : phase);
        }
        if (!current.shotActive && last.shotActive) {
            // The finished frame carries the final duration; fall back to the last running frame.
            JSONObject process = current.process != null ? current.process : last.process;
            long seconds = Math.round(process.optDouble("e", 0) / 1000);
            String weight = current.weight > 0 ? String.format(java.util.Locale.ROOT, ", %.1f g", current.weight) : "";
            listener.onEvent("shotFinished", "Shot finished", seconds + " s" + weight);
        }
        if (current.systemError && !last.systemError) {
            String message = current.systemMessage.isEmpty() ? "The controller reported an error." : current.systemMessage;
            listener.onEvent("errors", "Machine error", message);
        }
        for (String key : current.warnings) {
            if (last.warnings.contains(key)) continue;
            String label = warningLabels.containsKey(key) ? warningLabels.get(key) : key;
            boolean isError = current.warningLevels.getOrDefault(key, 0) >= WARNING_ERROR;
            listener.onEvent(isError ? "errors" : "warnings", isError ? "Error" : "Warning", label);
        }
    }

    // Preheated fires once the boiler climbs from clearly cold to target while in brew mode.
    private void trackPreheat(Snapshot current, boolean notify) {
        if (current.mode != MODE_BREW || current.target <= 0) {
            heating = false;
            return;
        }
        if (current.temperature < current.target - HEATING_BAND) {
            heating = true;
        } else if (heating && current.temperature >= current.target - READY_BAND) {
            heating = false;
            if (notify) listener.onEvent("preheated", "Ready to brew", "Boiler at " + Math.round(current.temperature) + " °C");
        }
    }

    // Fires once per steam session; a session already running on connect counts from then.
    private void trackSteam(Snapshot current, long now) {
        if (current.mode != MODE_STEAM) {
            steamSince = null;
            steamNotified = false;
            return;
        }
        if (steamSince == null) steamSince = now;
        if (!steamNotified && now - steamSince >= STEAM_LEFT_ON_MS) {
            steamNotified = true;
            listener.onEvent("steamLeftOn", "Still in steam mode", "Steam has been on for 5 minutes.");
        }
    }

    private static final class Snapshot {
        final int mode;
        final double temperature;
        final double target;
        final JSONObject process;
        final boolean shotActive;
        final double weight;
        final boolean systemError;
        final String systemMessage;
        final Set<String> warnings = new HashSet<>();
        final Map<String, Integer> warningLevels = new HashMap<>();

        Snapshot(JSONObject status) {
            mode = status.optInt("m", 0);
            temperature = status.optDouble("ct", 0);
            target = status.optDouble("tt", 0);
            process = status.optJSONObject("process");
            weight = status.optDouble("cw", 0);
            // Brews only: flushes, backflushes and descaling run as utility brews, grinding isn't a shot.
            String kind = process != null ? process.optString("s", "") : "";
            shotActive = process != null
                && (kind.equals("brew") || kind.equals("infusion"))
                && process.optInt("u", 0) == 0
                && process.optInt("a", 0) == 1;
            JSONObject sys = status.optJSONObject("sys");
            systemError = sys != null && "error".equals(sys.optString("s"));
            systemMessage = sys != null ? sys.optString("m", "") : "";
            JSONArray warn = status.optJSONArray("warn");
            if (warn != null) {
                for (int i = 0; i < warn.length(); i++) {
                    JSONObject w = warn.optJSONObject(i);
                    if (w == null) continue;
                    String key = w.optString("k");
                    int level = w.optInt("l", 0);
                    warningLevels.put(key, level);
                    if (level > 0 && w.optBoolean("a", true)) warnings.add(key);
                }
            }
        }
    }
}
