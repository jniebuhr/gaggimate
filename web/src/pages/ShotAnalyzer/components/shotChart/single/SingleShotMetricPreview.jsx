import { MetricValueGrid } from '../../ShotDetailsPanel';
import { MobileMetricPager } from '../MobileMetricPager';
import { SINGLE_METRIC_PAGE_KEYS } from '../constants';

function getSingleMetricPageLabels() {
  return [
    {
      key: SINGLE_METRIC_PAGE_KEYS.BASICS,
      label: 'Basics',
    },
    {
      key: SINGLE_METRIC_PAGE_KEYS.PRESSURE_FLOW,
      label: 'Pressure & Pump Flow',
    },
    {
      key: SINGLE_METRIC_PAGE_KEYS.FLOW_VOLUME,
      label: 'Flow & Volume',
    },
    {
      key: SINGLE_METRIC_PAGE_KEYS.TEMPERATURE,
      label: 'Temperature',
    },
  ];
}

export function ShotChartStaticMetricPreview({ activePageKey, onPageChange, results }) {
  const pages = getSingleMetricPageLabels();
  const activePage = pages.find(page => page.key === activePageKey) || pages[0];

  return (
    <div className='shot-chart-static-metric-preview'>
      <div className='shot-chart-static-metric-preview__grid'>
        <MetricValueGrid total={results?.total} excludeKeys={['duration', 'w', 'tt']} flat />
      </div>
      <MobileMetricPager
        activePageKey={activePage.key}
        className='shot-chart-mobile-metric-pager--caption'
        onPageChange={onPageChange}
        pages={pages}
        renderPage={page => (
          <div className='shot-chart-single-mobile-page-caption'>
            <span className='shot-chart-single-mobile-page-caption__label'>{page.label}</span>
            <span className='shot-chart-single-mobile-page-caption__hint'>Hover info</span>
          </div>
        )}
      />
    </div>
  );
}
