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
        <div className='nd-card w-full space-y-6 text-left'>
          <div className='border-b border-[var(--home-border,#222)] pb-4 text-center'>
            <h2 className='font-nd-mono text-[18px] text-[var(--text-primary,#e8e8e8)]'>
              No Shot Loaded
            </h2>
            <p className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-2'>
              Import a shot file or select one from your library to start analyzing.
            </p>
          </div>

          <p className='font-nd-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)] border-b border-[var(--home-border,#222)] pb-2'>
            Supported Sources
          </p>

          {/* GM Section */}
          <div className='flex items-start gap-4'>
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <SourceMarker source='gaggimate' variant='large' />
            </div>

            <div className='flex-1'>
              <h3 className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)] mb-1'>
                GaggiMate (GM)
              </h3>
              <p className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)] leading-relaxed'>
                Your saved shots and profiles directly from the GaggiMate internal storage.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className='h-px w-full bg-[var(--home-border,#222)]' />

          {/* VIEW Section */}
          <div className='flex items-start gap-4'>
            <div className='text-[var(--text-disabled,#666)] flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <FontAwesomeIcon icon={faEye} className='text-lg' />
            </div>

            <div className='flex-1'>
              <h3 className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)] mb-1'>
                Temporary View (VIEW)
              </h3>
              <p className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)] leading-relaxed'>
                Opens imported external shots and profiles temporarily without saving them to the
                browser library.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className='h-px w-full bg-[var(--home-border,#222)]' />

          {/* WEB Section */}
          <div className='flex items-start gap-4'>
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center'>
              <SourceMarker source='browser' variant='large' />
            </div>

            <div className='flex-1'>
              <h3 className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)] mb-1'>
                Local Browser Storage (WEB)
              </h3>
              <div className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)] leading-relaxed'>
                Stores imported external shots and profiles locally in this browser on this device.
                They are not automatically available in other browsers or on other devices.
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className='h-px w-full bg-[var(--home-border,#222)]' />

          <p className='font-nd-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)] border-b border-[var(--home-border,#222)] pb-2'>
            Import Guidance
          </p>

          <div className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)] leading-relaxed'>
            <span className='block'>
              Drag and drop files onto the status bar or use the import icons in the shot and
              profile badges.
            </span>
            <span className='mt-1 block'>
              Use the status bar toggle to switch between{' '}
              <span className='font-nd-mono text-[var(--text-primary,#e8e8e8)]'>View temporarily</span> and{' '}
              <span className='text-[var(--color-warning,#d4a843)]'>Save to Browser</span>{' '}
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
