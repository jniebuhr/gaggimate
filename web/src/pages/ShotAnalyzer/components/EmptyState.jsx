/**
 * EmptyState.jsx
 * * Empty state component for Shot Analyzer.
 * Explains the dual-source system to users.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
        <div className='bg-base-200/60 border-base-content/5 w-full space-y-6 rounded-xl border p-8 text-left shadow-sm'>
          <div className='border-base-content/10 space-y-2 border-b pb-4 text-center'>
            <h2 className='text-base-content text-2xl font-bold'>No Shot Loaded</h2>
            <p className='text-base-content text-sm opacity-70'>
              Import a shot file or select one from your library to start analyzing.
            </p>
          </div>

          <p className='text-base-content border-base-content/10 mb-4 border-b pb-2 text-sm font-bold tracking-wide uppercase'>
            Supported Sources
          </p>

          {/* GM Section */}
          <div className='flex items-start gap-4'>
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <SourceMarker source='gaggimate' variant='large' />
            </div>

            <div className='flex-1'>
              {/* REMOVED HOVER EFFECT */}
              <h3 className='text-base-content mb-1 text-sm font-bold'>GaggiMate (GM)</h3>
              <p className='text-base-content text-xs leading-relaxed'>
                Your saved shots and profiles directly from the GaggiMate internal storage.
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
              <h3 className='text-base-content mb-1 text-sm font-bold'>Temporary View (VIEW)</h3>
              <p className='text-base-content text-xs leading-relaxed'>
                Opens imported external shots and profiles temporarily without saving them to the
                browser library.
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
                Local Browser Storage (WEB)
              </h3>
              <div className='text-base-content text-xs leading-relaxed'>
                Stores imported external shots and profiles locally in this browser on this device.
                They are not automatically available in other browsers or on other devices.
              </div>
            </div>
          </div>

          {/* Divider - Subtle */}
          <div className='bg-base-content/5 h-px w-full'></div>

          <p className='text-base-content border-base-content/10 mb-4 border-b pb-2 text-sm font-bold tracking-wide uppercase'>
            Import Guidance
          </p>

          <div className='text-base-content text-xs leading-relaxed'>
            <span className='block'>
              Drag and drop files onto the status bar or use the import icons in the shot and
              profile badges.
            </span>
            <span className='mt-1 block'>
              Use the status bar toggle to switch between{' '}
              <span className='text-base-content font-bold'>View temporarily</span> and{' '}
              <span className='font-bold' style={{ color: analyzerUiColors.sourceBadgeWebText }}>
                Save to Browser
              </span>{' '}
              before importing.
            </span>
            <span className='mt-1 block'>Bulk upload and download are supported.</span>
          </div>
        </div>
        <div className='mx-auto max-w-2xl'>
          <DeepDiveLogoMark />
        </div>
      </div>
    </div>
  );
}
