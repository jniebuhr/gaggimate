import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function TabBar({ tabs, activeTab, onTabChange, basePath, className = '' }) {
  const location = useLocation();

  const handleTabClick = (tabId, event) => {
    if (basePath) {
      event.preventDefault();
      location.route(`${basePath}/${tabId}`);
    } else if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <div className={`w-full overflow-x-auto scrollbar-none ${className}`}>
      <div 
        role="tablist" 
        className="tabs tabs-border min-w-full px-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const href = basePath ? `${basePath}/${tab.id}` : '#';

          return (
            <a
              key={tab.id}
              href={href}
              onClick={(e) => handleTabClick(tab.id, e)}
              onMouseEnter={() => tab.preload?.()}
              onTouchStart={() => tab.preload?.()}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`tab h-12 text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? 'tab-active text-primary'
                  : 'text-base-content/60 hover:text-base-content/85'
              }`}
            >
              {tab.icon && (
                <FontAwesomeIcon icon={tab.icon} className="mr-2 h-4 w-4 shrink-0" />
              )}
              {tab.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
