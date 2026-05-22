import { useMemo, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { StatisticsView } from './components/StatisticsView';
import {
  normalizeStatisticsSourceSelection,
  parseStatisticsProfileRouteParams,
} from './utils/statisticsRoute';

// Statistics entry page: merges deep-link context with transient session hints.
// Route params stay canonical for profile source/name, while session state can
// carry extra one-off UI context like the current shot source and detail tab.
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
  const initialContext = useMemo(() => {
    const sessionContext = sessionInitialContext || {};
    const legacySource = normalizeStatisticsSourceSelection(sessionContext.source, '');
    const baseContext = {
      ...sessionContext,
      shotSource: normalizeStatisticsSourceSelection(
        sessionContext.shotSource || legacySource,
        'gaggimate',
      ),
      profileSource: normalizeStatisticsSourceSelection(
        sessionContext.profileSource || legacySource,
        'gaggimate',
      ),
    };
    baseContext.source = baseContext.profileSource;

    if (!routeInitialContext) return baseContext;

    return {
      ...baseContext,
      ...routeInitialContext,
      profileSource: routeInitialContext.source,
      source: routeInitialContext.source,
    };
  }, [routeInitialContext, sessionInitialContext]);

  return (
    <div className='pb-20'>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Statistics</h2>
      </div>

      <div className='w-full'>
        <StatisticsView initialContext={initialContext} />
      </div>
    </div>
  );
}
