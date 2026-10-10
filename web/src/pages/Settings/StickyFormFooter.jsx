import { useEffect, useRef } from 'preact/hooks';
import { Spinner } from '../../components/Spinner.jsx';

const FAB_CLEARANCE_PX = 64;
const FAB_GAP_PX = 12;

function syncMobileNavFabOffset(footer) {
  const root = document.documentElement;
  const rect = footer.getBoundingClientRect();
  const viewportBottom = window.innerHeight;
  const coversFabSlot =
    rect.top < viewportBottom && rect.bottom > viewportBottom - FAB_CLEARANCE_PX;

  if (!coversFabSlot) {
    root.style.removeProperty('--mobile-nav-fab-bottom');
    return;
  }

  root.style.setProperty(
    '--mobile-nav-fab-bottom',
    `${Math.ceil(viewportBottom - rect.top + FAB_GAP_PX)}px`,
  );
}

export function StickyFormFooter({ submitting, onRestart }) {
  const footerRef = useRef(null);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return undefined;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncMobileNavFabOffset(footer);
      });
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(footer);

    const scrollers = [];
    let parent = footer.parentElement;
    while (parent) {
      const { overflowY } = getComputedStyle(parent);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        parent.addEventListener('scroll', schedule, { passive: true });
        scrollers.push(parent);
      }
      parent = parent.parentElement;
    }
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      for (const scroller of scrollers) scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.documentElement.style.removeProperty('--mobile-nav-fab-bottom');
    };
  }, []);

  return (
    // -mb-4 clears the app shell p-4 so the bar stays flush with the screen bottom.
    <div
      ref={footerRef}
      className='border-base-content/10 bg-base-300/95 sticky bottom-0 z-40 mt-6 -mb-4 border-t pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md'
    >
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start sm:gap-4'>
        <div className='flex w-full items-center gap-2 sm:w-auto'>
          <button
            type='submit'
            className='btn btn-primary btn-sm flex-1 sm:flex-none'
            disabled={submitting}
          >
            {submitting && <Spinner size={4} className='mr-2' />}
            Save Settings
          </button>
          <button
            type='submit'
            name='restart'
            className='btn btn-secondary btn-sm flex-1 sm:flex-none'
            disabled={submitting}
            onClick={onRestart}
          >
            Save & Restart
          </button>
        </div>
        <div className='text-base-content/60 hidden text-[11px] leading-tight sm:block sm:max-w-xs'>
          * Restart required for Wi-Fi, Timezone, or Plugin changes.
        </div>
        <div className='text-base-content/60 text-center text-[11px] leading-tight sm:hidden'>
          * Restart required for Wi-Fi, Timezone, or Plugin changes.
        </div>
      </div>
    </div>
  );
}
