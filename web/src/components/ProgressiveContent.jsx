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
  loadingDelay = 200,
  minDisplayDuration = 500,
  ...componentProps
}) {
  const [status, setStatus] = useState(() => {
    return loaderCache.has(loader) ? 'ready' : 'idle';
  });
  
  const [loadedComponent, setLoadedComponent] = useState(() => {
    return loaderCache.get(loader) || null;
  });

  const loaderRef = useRef(loader);
  const statusRef = useRef(status);
  const skeletonShownAtRef = useRef(0);

  // Keep refs in sync
  loaderRef.current = loader;
  statusRef.current = status;

  useEffect(() => {
    const currentLoader = loader;
    
    if (loaderCache.has(currentLoader)) {
      setLoadedComponent(loaderCache.get(currentLoader));
      setStatus('ready');
      return;
    }

    setStatus('loading');
    const delayTimer = setTimeout(() => {
      if (loaderRef.current === currentLoader && statusRef.current === 'loading') {
        setStatus('skeleton');
        skeletonShownAtRef.current = Date.now();
      }
    }, loadingDelay);

    let isSubscribed = true;

    currentLoader().then(
      (module) => {
        if (!isSubscribed || loaderRef.current !== currentLoader) return;
        
        const resolvedComponent = module.default || module;
        loaderCache.set(currentLoader, resolvedComponent);
        setLoadedComponent(() => resolvedComponent);

        if (statusRef.current === 'skeleton') {
          // Calculate how long the skeleton was visible
          const elapsed = Date.now() - skeletonShownAtRef.current;
          const remaining = Math.max(0, minDisplayDuration - elapsed);

          if (remaining > 0) {
            setTimeout(() => {
              if (isSubscribed && loaderRef.current === currentLoader) {
                setStatus('transitioning');
              }
            }, remaining);
          } else {
            setStatus('transitioning');
          }
        } else {
          // Never showed the skeleton, show immediately without transition
          clearTimeout(delayTimer);
          setStatus('ready');
        }
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
      clearTimeout(delayTimer);
    };
  }, [loader, loadingDelay, minDisplayDuration]);

  // Handle transition completion (crossfade animation is 200ms)
  useEffect(() => {
    if (status === 'transitioning') {
      const timer = setTimeout(() => {
        setStatus('ready');
      }, 200); // matches transition durations in CSS
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'idle' || status === 'loading') {
    // Render an empty container with layout spacing to prevent collapse before skeleton triggers
    return <div className="min-h-16" />;
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

  if (status === 'transitioning' && loadedComponent) {
    const Component = loadedComponent;
    return (
      <div className="progressive-transition-container">
        <div className="progressive-transition-fade-out">
          <Skeleton />
        </div>
        <div className="progressive-transition-fade-in">
          <Component {...componentProps} />
        </div>
      </div>
    );
  }

  if (status === 'ready' && loadedComponent) {
    const Component = loadedComponent;
    return <Component {...componentProps} />;
  }

  return null;
}
