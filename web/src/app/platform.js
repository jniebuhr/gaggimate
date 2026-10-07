// True when built with `--mode app` for the Capacitor native shell.
export const isApp = import.meta.env.VITE_PLATFORM === 'app';

// 'ios' | 'android' | 'web'; window.Capacitor is injected by the native shell at runtime.
export const nativePlatform = () => window.Capacitor?.getPlatform?.() ?? 'web';
