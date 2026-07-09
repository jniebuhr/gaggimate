import PropTypes from 'prop-types';
import { useDashboardState } from './useDashboardState.js';
import { PANEL_DEFINITIONS, SPACER_ID } from '../../utils/panelDefinitions.js';
import {
  COLUMN_SPACINGS,
  columnSpacingSignal,
  compactPanelsSignal,
  panelOrderSignal,
  stickyBottomSignal,
  stickyTopSignal,
} from '../../utils/dashboardManager.js';

function Divider() {
  return <div className='border-base-content/10 border-t' />;
}

export function DashboardSidebar({ unified = false }) {
  const ds = useDashboardState();

  const panelOrder = panelOrderSignal.value;
  const stickyBottom = stickyBottomSignal.value;
  const stickyTop = stickyTopSignal.value;
  const compactPanels = compactPanelsSignal.value;
  const spacing = columnSpacingSignal.value;

  // Inject required panels missing from the stored order (safety net)
  const orderedIds = [
    ...panelOrder,
    ...PANEL_DEFINITIONS.filter(p => p.required && !panelOrder.includes(p.id)).map(p => p.id),
  ];

  const visiblePanels = orderedIds
    .map(id => PANEL_DEFINITIONS.find(p => p.id === id))
    .filter(Boolean)
    .filter(p => p.available(ds));

  // Spacer is excluded here so its position never affects which real panel
  // is considered "first"/"last" for sticky anchoring.
  const realOrderedIds = orderedIds.filter(id => id !== SPACER_ID);
  const firstConfiguredId = realOrderedIds[0];
  const lastConfiguredId = realOrderedIds.at(-1);

  // Split visible panels into sticky anchors and scrollable middle.
  // Sticky panels only anchor when they are ALSO the first/last in the configured
  // order — prevents the anchor transferring to a different panel when the
  // intended sticky panel is temporarily hidden (e.g. ActionCard when not brewing).
  const topPanel =
    stickyTop && visiblePanels[0]?.id === firstConfiguredId ? visiblePanels[0] : null;
  const bottomPanel =
    stickyBottom && visiblePanels.at(-1)?.id === lastConfiguredId ? visiblePanels.at(-1) : null;
  const middlePanels = visiblePanels.filter(p => p !== topPanel && p !== bottomPanel);

  const justifyClass = spacing === COLUMN_SPACINGS.BETWEEN ? 'justify-between' : 'justify-start';

  // A spacer in the order splits the middle panels into a top-packed group
  // and a bottom-packed group, with a flexible gap absorbing leftover space.
  const spacerIndex = orderedIds.indexOf(SPACER_ID);
  const hasSpacer = spacerIndex !== -1;
  const idsBeforeSpacer = hasSpacer ? new Set(orderedIds.slice(0, spacerIndex)) : null;
  const topGroup = hasSpacer ? middlePanels.filter(p => idsBeforeSpacer.has(p.id)) : middlePanels;
  const bottomGroup = hasSpacer ? middlePanels.filter(p => !idsBeforeSpacer.has(p.id)) : [];

  if (unified) {
    return (
      <div className='card bg-base-100 flex h-full flex-col gap-0 overflow-hidden rounded-xl'>
        {topPanel && (
          <div key={topPanel.id} className={topPanel.containerClass ?? ''}>
            <div className='p-3'>
              <topPanel.component
                {...topPanel.props(ds)}
                compact={compactPanels.includes(topPanel.id)}
                inCard
              />
            </div>
          </div>
        )}
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${hasSpacer ? '' : justifyClass}`}>
          {hasSpacer ? (
            <>
              {topGroup.map((panel, i) => (
                <div key={panel.id} className={panel.containerClass ?? ''}>
                  {(topPanel || i > 0) && <Divider />}
                  <div className='p-3'>
                    <panel.component
                      {...panel.props(ds)}
                      compact={compactPanels.includes(panel.id)}
                      inCard
                    />
                  </div>
                </div>
              ))}
              <div className='flex-1' aria-hidden='true' />
              {bottomGroup.map((panel, i) => (
                <div key={panel.id} className={panel.containerClass ?? ''}>
                  {(topPanel || topGroup.length > 0 || i > 0) && <Divider />}
                  <div className='p-3'>
                    <panel.component
                      {...panel.props(ds)}
                      compact={compactPanels.includes(panel.id)}
                      inCard
                    />
                  </div>
                </div>
              ))}
            </>
          ) : (
            middlePanels.map((panel, i) => (
              <div key={panel.id} className={panel.containerClass ?? ''}>
                {(topPanel || i > 0) && <Divider />}
                <div className='p-3'>
                  <panel.component
                    {...panel.props(ds)}
                    compact={compactPanels.includes(panel.id)}
                    inCard
                  />
                </div>
              </div>
            ))
          )}
        </div>
        {bottomPanel && (
          <div key={bottomPanel.id} className={bottomPanel.containerClass ?? ''}>
            {(topPanel || middlePanels.length > 0) && <Divider />}
            <div className='p-3'>
              <bottomPanel.component
                {...bottomPanel.props(ds)}
                compact={compactPanels.includes(bottomPanel.id)}
                inCard
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-2'>
      {topPanel && (
        <div key={topPanel.id} className={topPanel.containerClass ?? ''}>
          <topPanel.component
            {...topPanel.props(ds)}
            compact={compactPanels.includes(topPanel.id)}
          />
        </div>
      )}
      <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto ${hasSpacer ? '' : justifyClass}`}>
        {hasSpacer ? (
          <>
            {topGroup.length > 0 && (
              <div className='flex flex-col gap-2'>
                {topGroup.map(panel => (
                  <div key={panel.id} className={panel.containerClass ?? ''}>
                    <panel.component {...panel.props(ds)} compact={compactPanels.includes(panel.id)} />
                  </div>
                ))}
              </div>
            )}
            <div className='flex-1' aria-hidden='true' />
            {bottomGroup.length > 0 && (
              <div className='flex flex-col gap-2'>
                {bottomGroup.map(panel => (
                  <div key={panel.id} className={panel.containerClass ?? ''}>
                    <panel.component {...panel.props(ds)} compact={compactPanels.includes(panel.id)} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          middlePanels.map(panel => (
            <div key={panel.id} className={panel.containerClass ?? ''}>
              <panel.component {...panel.props(ds)} compact={compactPanels.includes(panel.id)} />
            </div>
          ))
        )}
      </div>
      {bottomPanel && (
        <div key={bottomPanel.id} className={bottomPanel.containerClass ?? ''}>
          <bottomPanel.component
            {...bottomPanel.props(ds)}
            compact={compactPanels.includes(bottomPanel.id)}
          />
        </div>
      )}
    </div>
  );
}

DashboardSidebar.propTypes = {
  unified: PropTypes.bool,
};
