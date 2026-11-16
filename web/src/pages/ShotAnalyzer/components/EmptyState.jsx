/**
 * EmptyState.jsx
 * * Empty state component for Shot Analyzer.
 * Explains device selection and temporary imports.
 */
import { Trans } from '@lingui/react/macro';
import { Spinner } from '../../../components/Spinner.jsx';
import DeepDiveLogoRaw from '../assets/deepdive.svg?raw';

const deepDiveLogoMarkup = DeepDiveLogoRaw.replace(
  '<svg width="2048" height="2048" viewBox="0 0 2048 2048" xmlns="http://www.w3.org/2000/svg">',
  '<svg width="100%" height="100%" viewBox="0 0 2048 2048" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="display:block;">',
).replaceAll('fill="#ffffff"', 'fill="currentColor"');

function DeepDiveLogoMark() {
  // Inline the original SVG markup from the asset file so the logo renders on
  // first paint without a second request and without manually duplicating its paths.
  return (
    <div
      className='mx-auto h-24 w-24 opacity-20 [&>svg]:h-full [&>svg]:w-full'
      style={{ color: 'var(--color-base-content)' }}
      // eslint-disable-next-line react/no-danger -- bundled SVG asset, not user input
      dangerouslySetInnerHTML={{ __html: deepDiveLogoMarkup }}
      aria-hidden='true'
    />
  );
}

export function EmptyState({ loading }) {
  if (loading) {
    return (
      <div className='flex min-h-[20vh] items-center justify-center p-8'>
        <Spinner />
      </div>
    );
  }
  return (
    <div className='flex min-h-[60vh] items-start justify-center pb-8'>
      <div className='w-full space-y-6 text-center'>
        {/* Info Box */}
        <div className='app-card-surface w-full space-y-6 rounded-xl p-8 text-left'>
          <div className='border-base-content/10 space-y-2 border-b pb-4 text-center'>
            <h2 className='text-base-content text-2xl font-bold'>
              <Trans>No Shot Loaded</Trans>
            </h2>
            <p className='text-base-content text-sm opacity-70'>
              <Trans>Import a shot file or select one from your library to start analyzing.</Trans>
            </p>
          </div>

          <div>
            <h3 className='text-base-content mb-1 text-sm font-bold'>
              <Trans>Saved shots and profiles</Trans>
            </h3>
            <p className='text-base-content text-xs leading-relaxed'>
              <Trans>Select saved shots and profiles directly from your GaggiMate.</Trans>
            </p>
          </div>
          <div className='bg-base-content/5 h-px w-full' />
          <div>
            <h3 className='text-base-content mb-1 text-sm font-bold'>
              <Trans>Temporary imports</Trans>
            </h3>
            <p className='text-base-content text-xs leading-relaxed'>
              <Trans>
                Use Import or drop shot and profile JSON files onto the status bar. Imported data is
                available until you reload the page.
              </Trans>
            </p>
            <p className='text-base-content mt-1 text-xs leading-relaxed'>
              <Trans>Bulk upload and download are supported.</Trans>
            </p>
          </div>
          <div className='bg-base-content/5 h-px w-full' />

          <div className='grid gap-2 text-xs leading-relaxed sm:grid-cols-3'>
            <div className='text-base-content'>
              <span className='bg-base-content/8 border-base-content/10 mr-2 inline-flex min-w-6 items-center justify-center rounded-md border px-1.5 py-0.5 font-bold'>
                X
              </span>{' '}
              <Trans>Open or close the library.</Trans>
            </div>
            <div className='text-base-content'>
              <span className='bg-base-content/8 border-base-content/10 mr-2 inline-flex min-w-6 items-center justify-center rounded-md border px-1.5 py-0.5 font-bold'>
                C
              </span>{' '}
              <Trans>Start or end compare mode.</Trans>
            </div>
            <div className='text-base-content'>
              <span className='bg-base-content/8 border-base-content/10 mr-2 inline-flex min-w-12 items-center justify-center rounded-md border px-1.5 py-0.5 font-bold'>
                ← →
              </span>{' '}
              <Trans>Switch between shots.</Trans>
            </div>
          </div>
        </div>
        <div className='mx-auto max-w-2xl'>
          <DeepDiveLogoMark />
        </div>
      </div>
    </div>
  );
}
