import { useRoute } from 'preact-iso';
import { AnalysisSkeleton } from '../../components/skeletons/AnalysisSkeleton.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TabBar from '../../components/TabBar.jsx';

import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';

import lazy from 'preact-iso/lazy';

const LazyShotHistory = lazy(() => import('../ShotHistory/index.jsx').then(m => m.ShotHistory));
const LazyShotAnalyzer = lazy(() => import('../ShotAnalyzer/index.jsx').then(m => m.ShotAnalyzer));
const LazyStatisticsPage = lazy(() =>
  import('../Statistics/index.jsx').then(m => m.StatisticsPage),
);

// Expose preloaders for the TabBar hover
const loadShotHistory = () => import('../ShotHistory/index.jsx');
const loadShotAnalyzer = () => import('../ShotAnalyzer/index.jsx');
const loadStatisticsPage = () => import('../Statistics/index.jsx');

function resolveAnalysisTab(params) {
  if (!params.tab) {
    if (params.source && params.id) {
      return 'analyzer';
    }
    if (params.sourceAlias && params.profileName) {
      return 'statistics';
    }
    return 'history';
  }
  return params.tab;
}

export function Analysis() {
  const { params } = useRoute();
  const tab = resolveAnalysisTab(params);

  return (
    <PageLayout variant='narrow'>
      <PageHeader
        title='Analysis'
        tabs={
          <TabBar
            tabs={[
              { id: 'history', label: 'Shot History', icon: faTimeline, preload: loadShotHistory },
              {
                id: 'analyzer',
                label: 'Shot Analyzer',
                icon: faMagnifyingGlassChart,
                preload: loadShotAnalyzer,
              },
              {
                id: 'statistics',
                label: 'Statistics',
                icon: faChartSimple,
                preload: loadStatisticsPage,
              },
            ]}
            activeTab={tab}
            basePath='/analysis'
          />
        }
      />

      {tab === 'history' && <LazyShotHistory isTab={true} />}
      {tab === 'analyzer' && <LazyShotAnalyzer isTab={true} params={params} />}
      {tab === 'statistics' && <LazyStatisticsPage isTab={true} params={params} />}
    </PageLayout>
  );
}
