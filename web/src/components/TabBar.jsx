import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useLingui } from '@lingui/react/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';

export default function TabBar({ tabs, activeTab, onTabChange, basePath, className = '' }) {
  const location = useLocation();
  const { t } = useLingui();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateOverflow = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    updateOverflow();
    el.addEventListener('scroll', updateOverflow, { passive: true });
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null;
    observer?.observe(el);
    observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', updateOverflow);
      observer?.disconnect();
    };
  }, []);

  // Keep the active tab visible, e.g. when deep-linking to a tab that starts off-screen
  useEffect(() => {
    const active = scrollRef.current?.querySelector(`#tab-${activeTab}`);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const scrollByPage = direction => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  const handleTabClick = (tabId, event) => {
    if (basePath) {
      event.preventDefault();
      location.route(`${basePath}/${tabId}`);
    } else if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const arrowClass =
    'absolute top-0 z-10 flex h-12 w-10 cursor-pointer items-center text-base-content/70 hover:text-base-content from-base-300 from-40% to-transparent';

  return (
    <div className={`relative w-full ${className}`}>
      <div ref={scrollRef} className='scrollbar-none w-full overflow-x-auto'>
        <div role='tablist' className='tabs tabs-border min-w-full flex-nowrap px-1'>
          {tabs.map(tab => {
            const isActive = tab.id === activeTab;
            const href = basePath ? `${basePath}/${tab.id}` : '#';

            return (
              <a
                key={tab.id}
                href={href}
                onClick={e => handleTabClick(tab.id, e)}
                onMouseEnter={() => tab.preload?.()}
                onTouchStart={() => tab.preload?.()}
                role='tab'
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                className={`tab flex h-12 flex-row items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'tab-active text-primary'
                    : 'text-base-content/60 hover:text-base-content/85'
                }`}
              >
                {tab.icon && <FontAwesomeIcon icon={tab.icon} className='h-4 w-4 shrink-0' />}
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>
      {canScrollLeft && (
        <button
          type='button'
          onClick={() => scrollByPage(-1)}
          aria-label={t`Scroll tabs left`}
          className={`${arrowClass} left-0 justify-start bg-linear-to-r pl-1`}
        >
          <FontAwesomeIcon icon={faChevronLeft} className='h-4 w-4' />
        </button>
      )}
      {canScrollRight && (
        <button
          type='button'
          onClick={() => scrollByPage(1)}
          aria-label={t`Scroll tabs right`}
          className={`${arrowClass} right-0 justify-end bg-linear-to-l pr-1`}
        >
          <FontAwesomeIcon icon={faChevronRight} className='h-4 w-4' />
        </button>
      )}
    </div>
  );
}
