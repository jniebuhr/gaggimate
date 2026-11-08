/**
 * EmptyState.jsx
 * * Empty state component for Shot Analyzer.
 * Explains the dual-source system to users.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans } from '@lingui/react/macro';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { analyzerUiColors } from '../utils/analyzerUtils.js';
import { Spinner } from '../../../components/Spinner.jsx';
import { SourceMarker } from './SourceMarker.jsx';
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

          {/* GM Section */}
          <div className='flex items-start gap-4'>
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <SourceMarker source='gaggimate' variant='large' />
            </div>

            <div className='flex-1'>
              {/* REMOVED HOVER EFFECT */}
              <h3 className='text-base-content mb-1 text-sm font-bold'>
                <Trans>GaggiMate (GM)</Trans>
              </h3>
              <p className='text-base-content text-xs leading-relaxed'>
                <Trans>
                  Your saved shots and profiles directly from the GaggiMate internal storage.
                </Trans>
              </p>
            </div>
          </div>

          {/* Divider - Subtle */}
          <div className='bg-base-content/5 h-px w-full'></div>

          {/* VIEW Section */}
          <div className='flex items-start gap-4'>
            <div className='text-base-content/45 flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <FontAwesomeIcon icon={faEye} className='text-lg' />
            </div>

            <div className='flex-1'>
              <h3 className='text-base-content mb-1 text-sm font-bold'>
                <Trans>Temporary View (VIEW)</Trans>
              </h3>
              <p className='text-base-content text-xs leading-relaxed'>
                <Trans>
                  Opens imported external shots and profiles temporarily without saving them to the
                  browser library.
                </Trans>
              </p>
            </div>
          </div>

          {/* Divider - Subtle */}
          <div className='bg-base-content/5 h-px w-full'></div>

          {/* WEB Section */}
          <div className='flex items-start gap-4'>
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <SourceMarker source='browser' variant='large' />
            </div>

            <div className='flex-1'>
              {/* REMOVED HOVER EFFECT */}
              <h3 className='text-base-content mb-1 text-sm font-bold'>
                <Trans>Local Browser Storage (WEB)</Trans>
              </h3>
              <div className='text-base-content text-xs leading-relaxed'>
                <Trans>
                  Stores imported external shots and profiles locally in this browser on this
                  device. They are not automatically available in other browsers or on other
                  devices.
                </Trans>
              </div>
            </div>
          </div>

          <div className='text-base-content text-xs leading-relaxed'>
            <span className='block'>
              <Trans>
                Drag and drop files onto the status bar or use the import icons in the shot and
                profile badges.
              </Trans>
            </span>
            <span className='mt-1 block'>
              <Trans>
                Use the status bar toggle to switch between{' '}
                <span className='text-base-content font-bold'>View temporarily</span> and{' '}
                <span className='font-bold' style={{ color: analyzerUiColors.sourceBadgeWebText }}>
                  Save to Browser
                </span>{' '}
                before importing.
              </Trans>
            </span>
            <span className='mt-1 block'>
              <Trans>Bulk upload and download are supported.</Trans>
            </span>
          </div>

          <div className='bg-base-content/5 h-px w-full'></div>

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
