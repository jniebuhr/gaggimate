/** Orchestrates single- and compare-shot detail cards and tab selection. */

import { ShotDetailsCard } from './ShotDetailsCard';

function getCompareDetailTabKey(entry, index) {
  return entry?.key || entry?.shot?.id || entry?.shotName || index;
}

function CompareShotTabs({ entries = [], activeIndex = 0, onChange = () => {} }) {
  const tabs = entries.map((entry, index) => ({
    id: getCompareDetailTabKey(entry, index),
    index,
    label: `Shot ${index + 1}`,
  }));

  if (tabs.length <= 1) return null;

  return (
    <div role='tablist' className='tabs tabs-border'>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type='button'
          role='tab'
          className={`tab ${activeIndex === tab.index ? 'tab-active' : ''}`}
          aria-selected={activeIndex === tab.index}
          onClick={() => onChange(tab.index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ShotDetailsPanel({
  entries = [],
  isCompareActive = false,
  activeCompareIndex = 0,
  onActiveCompareIndexChange = () => {},
}) {
  const validEntries = entries.filter(entry => entry?.shot);
  if (validEntries.length === 0) return null;

  if (isCompareActive) {
    const resolvedActiveIndex =
      activeCompareIndex >= 0 && activeCompareIndex < validEntries.length ? activeCompareIndex : 0;
    const activeEntry = validEntries[resolvedActiveIndex];

    return (
      <div className='flex h-full flex-col gap-3 lg:gap-6'>
        <CompareShotTabs
          entries={validEntries}
          activeIndex={resolvedActiveIndex}
          onChange={onActiveCompareIndexChange}
        />
        <div key={getCompareDetailTabKey(activeEntry, resolvedActiveIndex)} className='flex-1'>
          <ShotDetailsCard entry={activeEntry} isCompare={isCompareActive} />
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-3'>
      {validEntries.map((entry, index) => (
        <div key={getCompareDetailTabKey(entry, index)} className='flex-1'>
          <ShotDetailsCard entry={entry} isCompare={false} />
        </div>
      ))}
    </div>
  );
}
