package eu.gaggimate.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONArray;
import org.json.JSONObject;

// Keeps one WebSocket per saved machine while the app is in the background and posts its events as notifications.
public class MachineMonitorService extends Service {

    static final String EXTRA_CONFIG = "config";
    private static final String CHANNEL_MONITOR = "machine-monitor";
    // Shared with src/app/notifications.js (EVENTS_CHANNEL) so both paths use one Android setting.
    private static final String CHANNEL_EVENTS = "machine-events";
    private static final int MONITOR_NOTIFICATION_ID = 1;
    // Gives the web UI time to close its own sockets first, so a machine never sees both.
    private static final long CONNECT_DELAY_MS = 1500;
    private static final long MAX_RECONNECT_DELAY_MS = 30_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Connection> connections = new ArrayList<>();
    private final AtomicInteger nextNotificationId = new AtomicInteger(1000);
    private OkHttpClient client;
    private JSONObject events = new JSONObject();
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        JSONObject config;
        try {
            config = new JSONObject(intent != null ? intent.getStringExtra(EXTRA_CONFIG) : "{}");
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        JSONArray machines = config.optJSONArray("machines");
        int count = machines != null ? machines.length() : 0;
        createChannels();
        int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE : 0;
        ServiceCompat.startForeground(this, MONITOR_NOTIFICATION_ID, monitorNotification(count), type);
        if (count == 0) {
            stopSelf();
            return START_NOT_STICKY;
        }

        disconnectAll();
        acquireLocks();
        events = config.optJSONObject("events") != null ? config.optJSONObject("events") : new JSONObject();
        Map<String, String> labels = new HashMap<>();
        JSONObject labelJson = config.optJSONObject("warningLabels");
        if (labelJson != null) {
            for (Iterator<String> it = labelJson.keys(); it.hasNext(); ) {
                String key = it.next();
                labels.put(key, labelJson.optString(key));
            }
        }
        client = new OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build();
        for (int i = 0; i < count; i++) {
            JSONObject machine = machines.optJSONObject(i);
            if (machine == null) continue;
            connections.add(new Connection(machine.optString("name"), machine.optString("host"), labels));
        }
        handler.postDelayed(() -> {
            for (Connection connection : connections) connection.connect();
        }, CONNECT_DELAY_MS);
        // Not restarted by the system: the app restarts it the next time it goes to the background.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        disconnectAll();
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void disconnectAll() {
        handler.removeCallbacksAndMessages(null);
        for (Connection connection : connections) connection.close();
        connections.clear();
    }

    // Keeps the CPU and Wi-Fi awake so sockets and the steam timer keep running with the screen off.
    @SuppressWarnings("deprecation")
    private void acquireLocks() {
        if (wakeLock == null) {
            PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GaggiMate:monitor");
            wakeLock.setReferenceCounted(false);
        }
        wakeLock.acquire();
        if (wifiLock == null) {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "GaggiMate:monitor");
            wifiLock.setReferenceCounted(false);
        }
        wifiLock.acquire();
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(
            new NotificationChannel(CHANNEL_MONITOR, "Background monitoring", NotificationManager.IMPORTANCE_LOW)
        );
        manager.createNotificationChannel(
            new NotificationChannel(CHANNEL_EVENTS, "Machine events", NotificationManager.IMPORTANCE_HIGH)
        );
    }

    private PendingIntent openAppIntent() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification monitorNotification(int count) {
        return new NotificationCompat.Builder(this, CHANNEL_MONITOR)
            .setSmallIcon(R.drawable.ic_stat_gaggimate)
            .setContentTitle("Watching " + count + (count == 1 ? " machine" : " machines"))
            .setContentText("GaggiMate notifies you about shots, preheating and errors.")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openAppIntent())
            .build();
    }

    private void notifyEvent(String machineName, String event, String title, String body) {
        if (!events.optBoolean(event, false)) return;
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_EVENTS)
            .setSmallIcon(R.drawable.ic_stat_gaggimate)
            .setContentTitle(machineName + ": " + title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openAppIntent())
            .build();
        try {
            NotificationManagerCompat.from(this).notify(nextNotificationId.getAndIncrement(), notification);
        } catch (SecurityException ignored) {
            // Notification permission was revoked; nothing to show.
        }
    }

    // One machine's socket with reconnect backoff; frames arrive sequentially on OkHttp's reader thread.
    private final class Connection extends WebSocketListener {
        private final String name;
        private final String host;
        private final MachineEventDetector detector;
        private WebSocket socket;
        private long reconnectDelay = 1000;
        private boolean closed = false;

        Connection(String name, String host, Map<String, String> labels) {
            this.name = name;
            this.host = host;
            this.detector = new MachineEventDetector(labels, (event, title, body) -> notifyEvent(name, event, title, body));
        }

        void connect() {
            if (closed) return;
            socket = client.newWebSocket(new Request.Builder().url("ws://" + host + "/ws").build(), this);
        }

        void close() {
            closed = true;
            if (socket != null) socket.close(1000, null);
        }

        @Override
        public void onOpen(WebSocket webSocket, Response response) {
            reconnectDelay = 1000;
            detector.reset();
        }

        @Override
        public void onMessage(WebSocket webSocket, String text) {
            try {
                JSONObject frame = new JSONObject(text);
                if ("evt:status".equals(frame.optString("tp"))) detector.onFrame(frame, System.currentTimeMillis());
            } catch (Exception ignored) {
                // Malformed frame; skip it like the web UI does.
            }
        }

        @Override
        public void onClosed(WebSocket webSocket, int code, String reason) {
            scheduleReconnect();
        }

        @Override
        public void onFailure(WebSocket webSocket, Throwable t, Response response) {
            scheduleReconnect();
        }

        private void scheduleReconnect() {
            if (closed) return;
            handler.postDelayed(this::connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
        }
    }
}
