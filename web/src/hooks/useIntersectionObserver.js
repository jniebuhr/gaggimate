import { useEffect, useState } from 'preact/hooks';

export function useIntersectionObserver(ref, options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const { root, rootMargin, threshold } = options;

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting) {
        setHasIntersected(true);
      }
    }, { root, rootMargin, threshold });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, root, rootMargin, threshold]);

  return { isIntersecting, hasIntersected };
}
