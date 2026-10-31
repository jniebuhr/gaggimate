package eu.gaggimate.mobile;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Map;

// Browses the local network for GaggiMates advertising _gaggimate._tcp (see mDNSPlugin.cpp).
@CapacitorPlugin(name = "MachineDiscovery")
public class MachineDiscoveryPlugin extends Plugin {

    private static final String SERVICE_TYPE = "_gaggimate._tcp";

    private NsdManager nsd;
    private NsdManager.DiscoveryListener discoveryListener;
    // Before API 34 NsdManager resolves one service at a time, so resolves are queued.
    private final ArrayDeque<NsdServiceInfo> resolveQueue = new ArrayDeque<>();
    private boolean resolving = false;

    @PluginMethod
    public void start(PluginCall call) {
        stopDiscovery();
        nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onServiceFound(NsdServiceInfo info) {
                enqueueResolve(info);
            }

            @Override
            public void onServiceLost(NsdServiceInfo info) {
                JSObject machine = new JSObject();
                machine.put("name", info.getServiceName());
                notifyListeners("machineLost", machine);
            }

            @Override
            public void onDiscoveryStarted(String serviceType) {}

            @Override
            public void onDiscoveryStopped(String serviceType) {}

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {}

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
        };
        nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopDiscovery();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopDiscovery();
    }

    private void stopDiscovery() {
        if (nsd != null && discoveryListener != null) {
            try {
                nsd.stopServiceDiscovery(discoveryListener);
            } catch (IllegalArgumentException ignored) {
                // Listener was never registered or already stopped.
            }
        }
        discoveryListener = null;
        synchronized (resolveQueue) {
            resolveQueue.clear();
        }
    }

    private void enqueueResolve(NsdServiceInfo info) {
        synchronized (resolveQueue) {
            resolveQueue.add(info);
            if (resolving) return;
            resolving = true;
        }
        resolveNext();
    }

    @SuppressWarnings("deprecation")
    private void resolveNext() {
        NsdServiceInfo next;
        synchronized (resolveQueue) {
            next = resolveQueue.poll();
            if (next == null || nsd == null) {
                resolving = false;
                return;
            }
        }
        nsd.resolveService(next, new NsdManager.ResolveListener() {
            @Override
            public void onServiceResolved(NsdServiceInfo info) {
                notifyListeners("machineFound", toMachine(info));
                resolveNext();
            }

            @Override
            public void onResolveFailed(NsdServiceInfo info, int errorCode) {
                resolveNext();
            }
        });
    }

    // Android can't reliably resolve .local names, so the machine is reached by its resolved IP.
    @SuppressWarnings("deprecation")
    private static JSObject toMachine(NsdServiceInfo info) {
        InetAddress address = Build.VERSION.SDK_INT >= 34 && !info.getHostAddresses().isEmpty()
            ? info.getHostAddresses().get(0)
            : info.getHost();
        String host = address.getHostAddress();
        if (info.getPort() != 80) host += ":" + info.getPort();
        Map<String, byte[]> txt = info.getAttributes();
        byte[] version = txt.get("version");
        JSObject machine = new JSObject();
        machine.put("name", info.getServiceName());
        machine.put("host", host);
        machine.put("version", version == null ? "" : new String(version, StandardCharsets.UTF_8));
        return machine;
    }
}
