import { useState, useEffect, useRef } from 'preact/hooks';

// Module-level cache to store resolved modules.
// Key: load function itself, Value: Resolved component
const loaderCache = new Map();

/**
 * Preloads a component. Can be called on tab hover/touch.
 * @param {Function} loader - The dynamic import function (e.g. () => import('./MyComponent.jsx'))
 */
export function preloadComponent(loader) {
  if (loaderCache.has(loader)) return;
  // Trigger the dynamic import promise. Browser caches the evaluation/network chunk automatically.
  loader().then(
    (comp) => {
      const resolved = comp.default || comp;
      loaderCache.set(loader, resolved);
    },
    (err) => {
      console.error('Failed to preload component:', err);
    }
  );
}

/**
 * ProgressiveContent Component
 * Implements a state machine to prevent skeleton flashing and coordinate a smooth crossfade.
 */
export function ProgressiveContent({
  loader,
  skeleton: Skeleton,
  loadingDelay = 0,
  minDisplayDuration = 500,
  isLoading = false,
  children,
  ...componentProps
}) {
  // A component is "ready" to show if its code is loaded (or not needed) AND data is not loading.
  const isCodeLoadedInitially = !loader || loaderCache.has(loader);
  
  const [status, setStatus] = useState(() => {
    return (isCodeLoadedInitially && !isLoading) ? 'ready' : 'idle';
  });
  
  const [loadedComponent, setLoadedComponent] = useState(() => {
    return loader && loaderCache.has(loader) ? loaderCache.get(loader) : null;
  });

  const loaderRef = useRef(loader);
  const statusRef = useRef(status);
  const skeletonShownAtRef = useRef(0);
  const isLoadingRef = useRef(isLoading);

  // Keep refs in sync
  loaderRef.current = loader;
  statusRef.current = status;
  isLoadingRef.current = isLoading;

  // 1. Code Loading Effect
  useEffect(() => {
    if (!loader) return;
    
    const currentLoader = loader;
    if (loaderCache.has(currentLoader)) {
      setLoadedComponent(() => loaderCache.get(currentLoader));
      return;
    }
    
    let isSubscribed = true;
    currentLoader().then(
      (module) => {
        if (!isSubscribed || loaderRef.current !== currentLoader) return;
        const resolvedComponent = module.default || module;
        loaderCache.set(currentLoader, resolvedComponent);
        setLoadedComponent(() => resolvedComponent);
      },
      (error) => {
        console.error('ProgressiveContent failed to load chunk:', error);
        if (isSubscribed && loaderRef.current === currentLoader) {
          setStatus('error');
        }
      }
    );
    return () => {
      isSubscribed = false;
    };
  }, [loader]);

  // 2. State Machine Effect (Depends on Code loaded and Data loading)
  useEffect(() => {
    const currentLoader = loader;
    const isCodeLoaded = !loader || loadedComponent !== null;
    const isReadyToShow = isCodeLoaded && !isLoading;

    if (statusRef.current === 'error') return;

    if (isReadyToShow) {
      if (statusRef.current === 'skeleton') {
        const elapsed = Date.now() - skeletonShownAtRef.current;
        const remaining = Math.max(0, minDisplayDuration - elapsed);

        if (remaining > 0) {
          const timeoutId = setTimeout(() => {
            if (loaderRef.current === currentLoader && !isLoadingRef.current) {
              setStatus('transitioning');
            }
          }, remaining);
          return () => clearTimeout(timeoutId);
        } else {
          setStatus('transitioning');
        }
      } else if (statusRef.current === 'idle' || statusRef.current === 'loading') {
        // Never showed the skeleton, show immediately without transition
        setStatus('ready');
      }
    } else if (statusRef.current === 'ready' || statusRef.current === 'idle') {
      // Need to show skeleton or loading
      setStatus('loading');
      const delayTimer = setTimeout(() => {
        if (loaderRef.current === currentLoader && statusRef.current === 'loading') {
          setStatus('skeleton');
          skeletonShownAtRef.current = Date.now();
        }
      }, loadingDelay);
      return () => clearTimeout(delayTimer);
    }
  }, [loadedComponent, isLoading, loader, loadingDelay, minDisplayDuration]);

  // Handle transition completion (crossfade animation is 250ms)
  useEffect(() => {
    if (status === 'transitioning') {
      const timer = setTimeout(() => {
        setStatus('ready');
      }, 250); // matches transition durations in CSS
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'idle' || status === 'loading') {
    // Render the skeleton but make it invisible so it occupies the exact same layout space
    // and prevents layout shift (jank) when the skeleton or component loads
    return (
      <div className="opacity-0 pointer-events-none select-none transition-none">
        <Skeleton />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="alert alert-error my-4">
        <span>Failed to load component. Please check your connection or reload the page.</span>
      </div>
    );
  }

  if (status === 'skeleton') {
    return <Skeleton />;
  }

  if (status === 'transitioning' && (loadedComponent || children)) {
    const Component = loadedComponent;
    return (
      <div className="progressive-transition-container">
        <div className="progressive-transition-fade-out">
          <Skeleton />
        </div>
        <div className="progressive-transition-fade-in">
          {Component ? <Component {...componentProps} /> : children}
        </div>
      </div>
    );
  }

  if (status === 'ready' && (loadedComponent || children)) {
    const Component = loadedComponent;
    return Component ? <Component {...componentProps} /> : children;
  }

  return null;
}
