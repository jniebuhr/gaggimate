import { useMemo, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { StatisticsView } from './components/StatisticsView';
import { parseStatisticsProfileRouteParams } from './utils/statisticsRoute';

// Statistics entry page: resolves prefill context from route deep links first,
// then falls back to sessionStorage compatibility, then a plain GM default.
export function StatisticsPage() {
  const { params } = useRoute();
  const [sessionInitialContext] = useState(() => {
    try {
      const raw = sessionStorage.getItem('statsInitialContext');
      if (raw) {
        sessionStorage.removeItem('statsInitialContext');
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  });
  const routeInitialContext = useMemo(() => parseStatisticsProfileRouteParams(params), [params]);
  // Route-based deep links are canonical and should win over transient session state.
  const initialContext = routeInitialContext || sessionInitialContext || { source: 'gaggimate' };

  return (
    <div className='pb-20'>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Statistics</h2>
      </div>

      <div className='container mx-auto max-w-7xl'>
        <StatisticsView initialContext={initialContext} />
      </div>
    </div>
  );
}
