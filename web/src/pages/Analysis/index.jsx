import { useRoute } from 'preact-iso';
import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TabBar from '../../components/TabBar.jsx';

import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';

import { ProgressiveContent, preloadComponent } from '../../components/ProgressiveContent.jsx';
import { AnalysisSkeleton } from '../../components/Skeletons.jsx';

const loadShotHistory = () => import('../ShotHistory/index.jsx').then(m => m.ShotHistory);
const loadShotAnalyzer = () => import('../ShotAnalyzer/index.jsx').then(m => m.ShotAnalyzer);
const loadStatisticsPage = () => import('../Statistics/index.jsx').then(m => m.StatisticsPage);

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
    <PageLayout variant="wide">
      <PageHeader title="Analysis" />
      <TabBar
        tabs={[
          { id: 'history',    label: 'Shot History',    icon: faTimeline, preload: () => preloadComponent(loadShotHistory) },
          { id: 'analyzer',   label: 'Shot Analyzer',   icon: faMagnifyingGlassChart, preload: () => preloadComponent(loadShotAnalyzer) },
          { id: 'statistics', label: 'Statistics',      icon: faChartSimple, preload: () => preloadComponent(loadStatisticsPage) },
        ]}
        activeTab={tab}
        basePath="/analysis"
        className="-mb-4 lg:-mb-6"
      />
      
      {tab === 'history' && (
        <ProgressiveContent
          loader={loadShotHistory}
          skeleton={AnalysisSkeleton}
          isTab={true}
        />
      )}
      {tab === 'analyzer' && (
        <ProgressiveContent
          loader={loadShotAnalyzer}
          skeleton={AnalysisSkeleton}
          isTab={true}
          params={params}
        />
      )}
      {tab === 'statistics' && (
        <ProgressiveContent
          loader={loadStatisticsPage}
          skeleton={AnalysisSkeleton}
          isTab={true}
          params={params}
        />
      )}
    </PageLayout>
  );
}

