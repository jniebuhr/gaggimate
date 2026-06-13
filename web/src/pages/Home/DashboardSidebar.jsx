import PropTypes from 'prop-types';
import { useDashboardState } from './useDashboardState.js';
import { PANEL_DEFINITIONS } from '../../utils/panelDefinitions.js';
import { panelOrderSignal, stickyBottomSignal } from '../../utils/dashboardManager.js';

function Divider() {
  return <div className='border-t border-base-content/10' />;
}

export function DashboardSidebar({ unified = false }) {
  const ds = useDashboardState();

  const panelOrder = panelOrderSignal.value;
  const sticky = stickyBottomSignal.value;

  // Inject required panels missing from the stored order (safety net)
  const orderedIds = [
    ...panelOrder,
    ...PANEL_DEFINITIONS
      .filter(p => p.required && !panelOrder.includes(p.id))
      .map(p => p.id),
  ];

  const visiblePanels = orderedIds
    .map(id => PANEL_DEFINITIONS.find(p => p.id === id))
    .filter(Boolean)
    .filter(p => p.available(ds));

  if (unified) {
    return (
      <div className='card bg-base-100 flex h-full flex-col gap-0 overflow-hidden rounded-xl'>
        {visiblePanels.map((panel, i) => {
          const isFirst = i === 0;
          const isLast = i === visiblePanels.length - 1;
          return (
            <div
              key={panel.id}
              className={[
                isLast && sticky ? 'mt-auto' : '',
                panel.containerClass ?? '',
              ].filter(Boolean).join(' ')}
            >
              {!isFirst && <Divider />}
              <div className='p-3'>
                <panel.component {...panel.props(ds)} inCard />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-2'>
      {visiblePanels.map((panel, i) => {
        const isLast = i === visiblePanels.length - 1;
        return (
          <div
            key={panel.id}
            className={[
              isLast && sticky ? 'mt-auto' : '',
              panel.containerClass ?? '',
            ].filter(Boolean).join(' ')}
          >
            <panel.component {...panel.props(ds)} />
          </div>
        );
      })}
    </div>
  );
}

DashboardSidebar.propTypes = {
  unified: PropTypes.bool,
};
