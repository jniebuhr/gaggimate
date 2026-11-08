package eu.gaggimate.mobile;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Hands machine monitoring to MachineMonitorService while the app is in the background.
@CapacitorPlugin(name = "BackgroundMonitor")
public class BackgroundMonitorPlugin extends Plugin {

    // {machines: [{name, host}], events: {preheated: true, ...}, warningLabels: {water: "..."}}; null = disabled.
    private JSObject config;

    @PluginMethod
    public void configure(PluginCall call) {
        config = call.getBoolean("enabled", false) ? call.getData() : null;
        call.resolve();
    }

    // Started from onPause rather than a JS lifecycle event: Android only allows starting a foreground service while visible.
    @Override
    protected void handleOnPause() {
        if (config == null) return;
        Intent intent = new Intent(getContext(), MachineMonitorService.class);
        intent.putExtra(MachineMonitorService.EXTRA_CONFIG, config.toString());
        ContextCompat.startForegroundService(getContext(), intent);
    }

    @Override
    protected void handleOnResume() {
        getContext().stopService(new Intent(getContext(), MachineMonitorService.class));
    }
}
