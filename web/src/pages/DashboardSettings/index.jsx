import { useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompress } from '@fortawesome/free-solid-svg-icons/faCompress';
import Card from '../../components/Card.jsx';
import {
  SettingsFormField,
  SortableConfigurator,
  ToggleField,
} from '../../components/SettingsFormField.jsx';
import { machine } from '../../services/ApiService.js';
import {
  DASHBOARD_LAYOUTS, getDashboardLayout, setDashboardLayout,
  DASHBOARD_CARD_MODES, getDashboardCardMode, setDashboardCardMode,
  getMetricOrder, setMetricOrder as persistMetricOrder,
  getPanelOrder, setPanelOrder as persistPanelOrder,
  getStickyBottom, setStickyBottom,
  getStickyTop, setStickyTop,
  getShowRecentShots, setShowRecentShots,
  getMetricsColumns, setMetricsColumns,
  METRICS_LAST_ROW_FILLS, getMetricsLastRowFill, setMetricsLastRowFill,
  getCompactPanels, toggleCompactPanel,
  getProfileChartHeight, setProfileChartHeight,
  COLUMN_SPACINGS, getColumnSpacing, setColumnSpacing,
  getShotMetricSlots, setShotMetricSlots,
} from '../../utils/dashboardManager.js';
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions.js';
import { PANEL_DEFINITIONS } from '../../utils/panelDefinitions.js';

export function DashboardSettings() {
  const [dashboardLayout,    setDashboardLayoutState]    = useState(() => getDashboardLayout());
  const [dashboardCardMode,  setDashboardCardModeState]  = useState(() => getDashboardCardMode());
  const [showRecentShots,    setShowRecentShotsState]    = useState(() => getShowRecentShots());
  const [shotMetricSlots,    setShotMetricSlotsState]    = useState(() => getShotMetricSlots());

  const [panelOrder,         setPanelOrderState]         = useState(() => getPanelOrder());
  const [stickyBottom,       setStickyBottomState]       = useState(() => getStickyBottom());
  const [stickyTop,          setStickyTopState]          = useState(() => getStickyTop());
  const [compactPanels,      setCompactPanelsState]      = useState(() => getCompactPanels());
  const [profileChartHeight, setProfileChartHeightState] = useState(() => getProfileChartHeight());
  const [columnSpacing,      setColumnSpacingState]      = useState(() => getColumnSpacing());

  const [metricOrder,        setMetricOrderState]        = useState(() => getMetricOrder());
  const [metricsColumns,     setMetricsColumnsState]     = useState(() => getMetricsColumns());
  const [metricsLastRowFill, setMetricsLastRowFillState] = useState(() => getMetricsLastRowFill());

  const hiddenMetrics = METRIC_DEFINITIONS.filter(
    m => !m.required && !metricOrder.includes(m.id) && m.available(machine.value.status)
  );

  const hiddenPanels = PANEL_DEFINITIONS.filter(def => {
    if (def.required) return false;
    if (panelOrder.includes(def.id)) return false;
    const availFn = def.availableInSettings ?? def.available;
    return availFn(machine.value.status);
  });

  const handleToggleCompact = (id) => {
    toggleCompactPanel(id);
    setCompactPanelsState(getCompactPanels());
  };

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Dashboard Settings</h2>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>

        {/* ── Card 1: General Settings ─────────────────────────────────── */}
        <Card sm={10} lg={5} title='General Settings'>
          <SettingsFormField label='Dashboard Layout' htmlFor='dashboardLayout'>
            <select
              id='dashboardLayout'
              className='select select-bordered w-full'
              value={dashboardLayout}
              onChange={e => {
                setDashboardLayoutState(e.target.value);
                setDashboardLayout(e.target.value);
              }}
            >
              <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Process Controls First</option>
              <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
            </select>
          </SettingsFormField>
          <SettingsFormField label='Control Column Style' htmlFor='dashboardCardMode'>
            <select
              id='dashboardCardMode'
              className='select select-bordered w-full'
              value={dashboardCardMode}
              onChange={e => {
                setDashboardCardModeState(e.target.value);
                setDashboardCardMode(e.target.value);
              }}
            >
              <option value={DASHBOARD_CARD_MODES.MULTI}>Multiple Cards</option>
              <option value={DASHBOARD_CARD_MODES.SINGLE}>Single Card</option>
            </select>
          </SettingsFormField>
          <ToggleField
            label='Show Recent Shots'
            htmlFor='showRecentShots'
            checked={showRecentShots}
            onChange={e => {
              setShowRecentShotsState(e.target.checked);
              setShowRecentShots(e.target.checked);
            }}
          />
          {showRecentShots && (
            <SettingsFormField label='Shot Card Metrics' htmlFor='shotMetricSlot0' noMargin>
              <div className='flex gap-2'>
                {[0, 1, 2].map(i => (
                  <div key={i} className='flex flex-1 flex-col gap-1'>
                    <span className='text-base-content/60 text-xs'>Slot {i + 1}</span>
                    <select
                      className='select select-bordered select-sm w-full'
                      value={shotMetricSlots[i]}
                      onChange={e => {
                        const next = [...shotMetricSlots];
                        next[i] = e.target.value;
                        setShotMetricSlotsState(next);
                        setShotMetricSlots(next);
                      }}
                    >
                      <option value='duration'>Duration</option>
                      <option value='weight'>Weight</option>
                      <option value='avgTemp'>Avg Temp</option>
                      <option value='maxPressure'>Max Pressure</option>
                      <option value='avgFlow'>Avg Flow</option>
                    </select>
                  </div>
                ))}
              </div>
            </SettingsFormField>
          )}
        </Card>

        {/* ── Card 2: Panel Selection ───────────────────────────────────── */}
        <Card sm={10} lg={5} title='Panel Selection'>
          <ToggleField
            label='Stick first panel to top'
            htmlFor='stickyTop'
            checked={stickyTop}
            onChange={e => { setStickyTopState(e.target.checked); setStickyTop(e.target.checked); }}
          />
          <ToggleField
            label='Stick last panel to bottom'
            htmlFor='stickyBottom'
            checked={stickyBottom}
            onChange={e => { setStickyBottomState(e.target.checked); setStickyBottom(e.target.checked); }}
          />
          <SettingsFormField label='Column Spacing' htmlFor='columnSpacing'>
            <select
              id='columnSpacing'
              className='select select-bordered w-full'
              value={columnSpacing}
              onChange={e => { setColumnSpacingState(e.target.value); setColumnSpacing(e.target.value); }}
            >
              <option value={COLUMN_SPACINGS.START}>Pack to top</option>
              <option value={COLUMN_SPACINGS.BETWEEN}>Space evenly</option>
            </select>
          </SettingsFormField>
          <SortableConfigurator
            order={panelOrder}
            definitions={PANEL_DEFINITIONS}
            hidden={hiddenPanels}
            onOrderChange={ids => { setPanelOrderState(ids); persistPanelOrder(ids); }}
            emptyMessage='All available panels are visible.'
            extraControls={(def) => def.supportsCompact ? (
              <button
                type='button'
                title={compactPanels.includes(def.id) ? 'Switch to full view' : 'Switch to compact view'}
                onClick={() => handleToggleCompact(def.id)}
                className={`btn btn-ghost btn-xs flex h-6 w-6 items-center justify-center rounded p-0 ${compactPanels.includes(def.id) ? 'text-primary' : 'text-base-content/30'}`}
              >
                <FontAwesomeIcon icon={faCompress} className='h-3 w-3' />
              </button>
            ) : null}
          />
          {!compactPanels.includes('profile') && panelOrder.includes('profile') && (
            <SettingsFormField label='Profile Chart Height' htmlFor='profileChartHeight'>
              <div className='flex items-center gap-3'>
                <input
                  id='profileChartHeight'
                  type='range'
                  min='64'
                  max='256'
                  step='8'
                  className='range range-primary range-sm flex-1'
                  value={profileChartHeight}
                  onChange={e => {
                    const n = Number(e.target.value);
                    setProfileChartHeightState(n);
                    setProfileChartHeight(n);
                  }}
                />
                <span className='w-16 text-sm'>{profileChartHeight} px</span>
              </div>
            </SettingsFormField>
          )}
        </Card>

        {/* ── Card 3: Metric Selection ──────────────────────────────────── */}
        <Card sm={10} lg={5} title='Metric Selection'>
          <SettingsFormField label='Metrics Columns' htmlFor='metricsColumns'>
            <div className='flex items-center gap-3'>
              <input
                id='metricsColumns'
                type='range'
                min='1'
                max='4'
                step='1'
                className='range range-primary range-sm flex-1'
                value={metricsColumns}
                onChange={e => {
                  const n = Number(e.target.value);
                  setMetricsColumnsState(n);
                  setMetricsColumns(n);
                }}
              />
              <span className='w-20 text-sm'>{metricsColumns} {metricsColumns === 1 ? 'column' : 'columns'}</span>
            </div>
          </SettingsFormField>
          <SettingsFormField label='Last Row Fill' htmlFor='metricsLastRowFill'>
            <select
              id='metricsLastRowFill'
              className='select select-bordered w-full'
              value={metricsLastRowFill}
              onChange={e => {
                setMetricsLastRowFillState(e.target.value);
                setMetricsLastRowFill(e.target.value);
              }}
            >
              <option value={METRICS_LAST_ROW_FILLS.EVEN}>Even fill</option>
              <option value={METRICS_LAST_ROW_FILLS.GRID}>Align to grid</option>
            </select>
          </SettingsFormField>
          <SortableConfigurator
            order={metricOrder}
            definitions={METRIC_DEFINITIONS}
            hidden={hiddenMetrics}
            onOrderChange={ids => { setMetricOrderState(ids); persistMetricOrder(ids); }}
            emptyMessage='All available metrics are visible.'
          />
        </Card>

      </div>

      <div className='pt-4'>
        <div className='flex flex-col gap-2 pt-4 sm:flex-row'>
          <a href='/' className='btn btn-outline flex-1 sm:flex-none'>
            Back
          </a>
        </div>
      </div>
    </>
  );
}
