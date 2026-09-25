import { useEffect, useState } from 'preact/hooks';

/**
 * Wrap a dynamically imported component so its module (and everything it
 * pulls in) only downloads when it is first rendered.
 *
 * Used on the dashboard to keep Chart.js — ~90 KB gzipped with its plugins and
 * date adapter, almost half of a cold dashboard load from the ESP32 — out of
 * the entry bundle. The status cards paint immediately and the charts fill in
 * once their chunk arrives.
 *
 * @param {() => Promise<object>} loader   e.g. () => import('./Foo.jsx')
 * @param {string} exportName              named export to render
 * @param {(props) => any} Fallback        rendered until the module is ready
 */
export function lazyComponent(loader, exportName, Fallback = () => null) {
  let cached = null;
  let pending = null;
  const load = () => {
    if (!pending) pending = loader().then(m => (cached = m[exportName]));
    return pending;
  };

  return function Lazy(props) {
    const [Component, setComponent] = useState(() => cached);

    useEffect(() => {
      if (Component) return undefined;
      let cancelled = false;
      load().then(c => {
        if (!cancelled) setComponent(() => c);
      });
      return () => {
        cancelled = true;
      };
    }, [Component]);

    return Component ? <Component {...props} /> : <Fallback {...props} />;
  };
}
