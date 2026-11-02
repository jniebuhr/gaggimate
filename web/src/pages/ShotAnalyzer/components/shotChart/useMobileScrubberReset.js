import { useEffect } from 'preact/hooks';

export function useMobileScrubberReset({ enabled, hasActiveScrubValue, scrubberRef, onReset }) {
  useEffect(() => {
    if (!enabled || !hasActiveScrubValue) return undefined;
    const browserWindow = globalThis.window;
    const browserDocument = globalThis.document;
    if (!browserWindow || !browserDocument) return undefined;

    // A mobile scrub acts like a temporary hover state, so outside taps and page
    // scrolling should close it instead of leaving stale chart guides on screen.
    const handlePointerDown = event => {
      if (scrubberRef.current?.contains(event.target)) return;
      onReset();
    };
    const handleScroll = () => {
      onReset();
    };

    browserDocument.addEventListener('pointerdown', handlePointerDown, true);
    browserWindow.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    browserDocument.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      browserDocument.removeEventListener('pointerdown', handlePointerDown, true);
      browserWindow.removeEventListener('scroll', handleScroll, { capture: true });
      browserDocument.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [enabled, hasActiveScrubValue, onReset, scrubberRef]);
}
