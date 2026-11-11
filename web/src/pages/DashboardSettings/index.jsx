import { useEffect, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import { faCompress } from '@fortawesome/free-solid-svg-icons/faCompress';
import Card from '../../components/Card.jsx';
import { Tooltip } from '../../components/Tooltip.jsx';
import {
  SettingsFormField,
  SortableConfigurator,
  ToggleField,
} from '../../components/SettingsFormField.jsx';
import { machine } from '../../services/ApiService.js';
import {
  DASHBOARD_LAYOUTS,
  getDashboardLayout,
  setDashboardLayout,
  DASHBOARD_CARD_MODES,
  getDashboardCardMode,
  setDashboardCardMode,
  getMetricOrder,
  setMetricOrder as persistMetricOrder,
  getPanelOrder,
  setPanelOrder as persistPanelOrder,
  getStickyBottom,
  setStickyBottom,
  getStickyTop,
  setStickyTop,
  getShowRecentShots,
  setShowRecentShots,
  getRecentShotCount,
  setRecentShotCount,
  getMetricsColumns,
  setMetricsColumns,
  METRICS_LAST_ROW_FILLS,
  getMetricsLastRowFill,
  setMetricsLastRowFill,
  getCompactPanels,
  toggleCompactPanel,
  getProfileChartHeight,
  setProfileChartHeight,
  COLUMN_SPACINGS,
  getColumnSpacing,
  setColumnSpacing,
  getShotMetricSlots,
  setShotMetricSlots,
  DASHBOARD_MODES,
  getDashboardMode,
  setDashboardMode,
} from '../../utils/dashboardManager.js';
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions.js';
import { PANEL_DEFINITIONS, SPACER_ID, SPACER_DEFINITION } from '../../utils/panelDefinitions.js';

export function DashboardSettings() {
  const { t } = useLingui();
  const [dashboardLayout, setDashboardLayoutState] = useState(() => getDashboardLayout());
  const [dashboardCardMode, setDashboardCardModeState] = useState(() => getDashboardCardMode());
  const [showRecentShots, setShowRecentShotsState] = useState(() => getShowRecentShots());
  const [recentShotCount, setRecentShotCountState] = useState(() => getRecentShotCount());
  const [shotMetricSlots, setShotMetricSlotsState] = useState(() => getShotMetricSlots());

  const [panelOrder, setPanelOrderState] = useState(() => getPanelOrder());
  const [stickyBottom, setStickyBottomState] = useState(() => getStickyBottom());
  const [stickyTop, setStickyTopState] = useState(() => getStickyTop());
  const [compactPanels, setCompactPanelsState] = useState(() => getCompactPanels());
  const [profileChartHeight, setProfileChartHeightState] = useState(() => getProfileChartHeight());
  const [columnSpacing, setColumnSpacingState] = useState(() => getColumnSpacing());

  const [metricOrder, setMetricOrderState] = useState(() => getMetricOrder());
  const [metricsColumns, setMetricsColumnsState] = useState(() => getMetricsColumns());
  const [metricsLastRowFill, setMetricsLastRowFillState] = useState(() => getMetricsLastRowFill());

  // Editing here means customizing — leave any active preset and show the stored values.
  useEffect(() => {
    setDashboardMode(DASHBOARD_MODES.CUSTOM);
  }, []);

  // Covers a preset being selected from the nav dropdown while this page stays mounted.
  const markCustomized = () => {
    if (getDashboardMode() !== DASHBOARD_MODES.CUSTOM) {
      setDashboardMode(DASHBOARD_MODES.CUSTOM);
    }
  };

  // Home passes its dashboard state to available(); mirror the fields those checks read from here.
  const availability = {
    ...machine.value.status,
    ledControl: machine.value.capabilities.ledControl,
  };

  const hiddenMetrics = METRIC_DEFINITIONS.filter(
    m => !m.required && !metricOrder.includes(m.id) && m.available(availability),
  );

  const hiddenPanels = [
    ...PANEL_DEFINITIONS.filter(def => {
      if (def.required) return false;
      if (panelOrder.includes(def.id)) return false;
      const availFn = def.availableInSettings ?? def.available;
      return availFn(availability);
    }),
    ...(panelOrder.includes(SPACER_ID) ? [] : [SPACER_DEFINITION]),
  ];

  const handleToggleCompact = id => {
    toggleCompactPanel(id);
    setCompactPanelsState(getCompactPanels());
  };

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>
          <Trans>Dashboard Settings</Trans>
        </h2>
      </div>

      <div
        className='grid grid-cols-1 gap-4 lg:grid-cols-10'
        onChangeCapture={markCustomized}
        onClickCapture={markCustomized}
      >
        {/* ── Card 1: General Settings ─────────────────────────────────── */}
        <Card sm={10} lg={5} title={t`General Settings`}>
          <SettingsFormField label={t`Dashboard Layout`} htmlFor='dashboardLayout'>
            <select
              id='dashboardLayout'
              className='select select-bordered w-full'
              value={dashboardLayout}
              onChange={e => {
                setDashboardLayoutState(e.target.value);
                setDashboardLayout(e.target.value);
              }}
            >
              <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>{t`Process Controls First`}</option>
              <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>{t`Chart First`}</option>
            </select>
          </SettingsFormField>
          <SettingsFormField
            label={t`Control Column Style`}
            htmlFor='dashboardCardMode'
            helpText={t`Show the control column panels as separate cards, or group them into a single unified card.`}
            noMargin
          >
            <select
              id='dashboardCardMode'
              className='select select-bordered w-full'
              value={dashboardCardMode}
              onChange={e => {
                setDashboardCardModeState(e.target.value);
                setDashboardCardMode(e.target.value);
              }}
            >
              <option value={DASHBOARD_CARD_MODES.MULTI}>{t`Multiple Cards`}</option>
              <option value={DASHBOARD_CARD_MODES.SINGLE}>{t`Single Card`}</option>
            </select>
          </SettingsFormField>
        </Card>

        {/* ── Card 2: Recent Shots ──────────────────────────────────────── */}
        <Card sm={10} lg={5} title={t`Recent Shots`}>
          <ToggleField
            label={t`Show Recent Shots`}
            htmlFor='showRecentShots'
            checked={showRecentShots}
            onChange={e => {
              setShowRecentShotsState(e.target.checked);
              setShowRecentShots(e.target.checked);
            }}
          />
          {showRecentShots && (
            <>
              <SettingsFormField label={t`Max Recent Shots`} htmlFor='recentShotCount'>
                <div className='flex items-center gap-3'>
                  <input
                    id='recentShotCount'
                    type='range'
                    min='1'
                    max='8'
                    step='1'
                    className='range range-primary range-sm flex-1'
                    value={recentShotCount}
                    onChange={e => {
                      const n = Number(e.target.value);
                      setRecentShotCountState(n);
                      setRecentShotCount(n);
                    }}
                  />
                  <span className='w-20 text-sm'>
                    {plural(recentShotCount, { one: '# shot', other: '# shots' })}
                  </span>
                </div>
              </SettingsFormField>
              <SettingsFormField label={t`Shot Card Metrics`} htmlFor='shotMetricSlot0' noMargin>
                <div className='flex gap-2'>
                  {[0, 1, 2].map(i => {
                    const slotNumber = i + 1;
                    return (
                      <div key={i} className='flex flex-1 flex-col gap-1'>
                        <span className='text-base-content/60 text-xs'>{t`Slot ${slotNumber}`}</span>
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
                          <option value='duration'>{t`Duration`}</option>
                          <option value='weight'>{t`Weight`}</option>
                          <option value='avgTemp'>{t`Avg Temp`}</option>
                          <option value='maxPressure'>{t`Max Pressure`}</option>
                          <option value='avgFlow'>{t`Avg Flow`}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </SettingsFormField>
            </>
          )}
        </Card>

        {/* ── Card 3: Panel Selection ───────────────────────────────────── */}
        <Card sm={10} lg={5} title={t`Panel Selection`}>
          <ToggleField
            label={t`Stick first panel to top`}
            htmlFor='stickyTop'
            checked={stickyTop}
            onChange={e => {
              setStickyTopState(e.target.checked);
              setStickyTop(e.target.checked);
            }}
          />
          <ToggleField
            label={t`Stick last panel to bottom`}
            htmlFor='stickyBottom'
            checked={stickyBottom}
            onChange={e => {
              setStickyBottomState(e.target.checked);
              setStickyBottom(e.target.checked);
            }}
          />
          <SettingsFormField
            label={t`Column Spacing`}
            htmlFor='columnSpacing'
            helpText={
              panelOrder.includes(SPACER_ID)
                ? t`Ignored while a Flexible Space item is present in the panel list below.`
                : t`Controls how panels are distributed vertically: pack them to the top, or space them evenly across the column.`
            }
          >
            <select
              id='columnSpacing'
              className='select select-bordered w-full'
              value={columnSpacing}
              onChange={e => {
                setColumnSpacingState(e.target.value);
                setColumnSpacing(e.target.value);
              }}
            >
              <option value={COLUMN_SPACINGS.START}>{t`Pack to top`}</option>
              <option value={COLUMN_SPACINGS.BETWEEN}>{t`Space evenly`}</option>
            </select>
          </SettingsFormField>
          <SortableConfigurator
            order={panelOrder}
            definitions={[...PANEL_DEFINITIONS, SPACER_DEFINITION]}
            hidden={hiddenPanels}
            onOrderChange={ids => {
              setPanelOrderState(ids);
              persistPanelOrder(ids);
            }}
            emptyMessage={t`All available panels are visible.`}
            extraControls={def => {
              if (!def.supportsCompact) return null;
              const isCompact = compactPanels.includes(def.id);
              return (
                <Tooltip
                  content={
                    isCompact
                      ? t`Compact mode is on — click to show the full panel`
                      : t`Enables compact mode for this panel`
                  }
                >
                  <button
                    type='button'
                    aria-label={isCompact ? t`Switch to full view` : t`Switch to compact view`}
                    onClick={() => handleToggleCompact(def.id)}
                    className={`btn btn-xs flex h-6 items-center justify-center gap-1 rounded-full px-2 ${
                      isCompact
                        ? 'btn-primary'
                        : 'border-base-content/20 bg-base-200/60 text-base-content/60 border'
                    }`}
                  >
                    <FontAwesomeIcon icon={faCompress} className='h-3 w-3' />
                    <span className='hidden @md:inline'>
                      {isCompact
                        ? t({ message: 'Compact', context: 'panel view' })
                        : t({ message: 'Full', context: 'panel view' })}
                    </span>
                  </button>
                </Tooltip>
              );
            }}
          />
          {!compactPanels.includes('profile') && panelOrder.includes('profile') && (
            <SettingsFormField
              label={t`Profile Chart Height`}
              htmlFor='profileChartHeight'
              helpText={t`Sets the height of the profile chart preview shown in the Profile Selector panel.`}
            >
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

        {/* ── Card 4: Metric Selection ──────────────────────────────────── */}
        <Card sm={10} lg={5} title={t`Metric Selection`}>
          <SettingsFormField
            label={t`Metrics Columns`}
            htmlFor='metricsColumns'
            helpText={t`Sets the maximum number of columns. On smaller screens, fewer columns are used to keep metrics readable.`}
          >
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
              <span className='w-20 text-sm'>
                {plural(metricsColumns, { one: '# column', other: '# columns' })}
              </span>
            </div>
          </SettingsFormField>
          <SettingsFormField
            label={t`Last Row Fill`}
            htmlFor='metricsLastRowFill'
            helpText={t`Controls how the last, incomplete row of metrics is laid out: stretch items evenly to fill the row, or keep them aligned to the column grid.`}
          >
            <select
              id='metricsLastRowFill'
              className='select select-bordered w-full'
              value={metricsLastRowFill}
              onChange={e => {
                setMetricsLastRowFillState(e.target.value);
                setMetricsLastRowFill(e.target.value);
              }}
            >
              <option value={METRICS_LAST_ROW_FILLS.EVEN}>{t`Even fill`}</option>
              <option value={METRICS_LAST_ROW_FILLS.GRID}>{t`Align to grid`}</option>
            </select>
          </SettingsFormField>
          <SortableConfigurator
            order={metricOrder}
            definitions={METRIC_DEFINITIONS}
            hidden={hiddenMetrics}
            onOrderChange={ids => {
              setMetricOrderState(ids);
              persistMetricOrder(ids);
            }}
            emptyMessage={t`All available metrics are visible.`}
          />
        </Card>
      </div>

      <div className='pt-4'>
        <div className='flex flex-col gap-2 pt-4 sm:flex-row'>
          <a href='/' className='btn btn-outline flex-1 sm:flex-none'>
            <Trans>Back</Trans>
          </a>
        </div>
      </div>
    </>
  );
}
