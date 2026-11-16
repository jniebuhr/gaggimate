import { useMemo, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { Trans } from '@lingui/react/macro';
import { StatisticsView } from './components/StatisticsView';
import { parseStatisticsProfileRouteParams } from './utils/statisticsRoute';

// Statistics entry page: merges deep-link context with transient session hints.
// Route params select the device profile; session state can carry the detail tab.
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
    // An unsupported deep link must not pick up a stale session profile preset.
    if (params?.sourceAlias && !routeInitialContext) return {};
    return {
      profileName: sessionInitialContext?.profileName || '',
      preferredDetailSection: sessionInitialContext?.preferredDetailSection,
      ...routeInitialContext,
    };
  }, [params?.sourceAlias, routeInitialContext, sessionInitialContext]);

  return (
    <div className='pb-20'>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>
          <Trans>Statistics</Trans>
        </h2>
      </div>

      <div className='w-full'>
        <StatisticsView initialContext={initialContext} />
      </div>
    </div>
  );
}
