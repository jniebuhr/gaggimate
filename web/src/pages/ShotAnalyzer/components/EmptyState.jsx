/**
 * EmptyState.jsx
 * * Empty state component for Shot Analyzer.
 * Explains the dual-source system to users.
 */
import { maskStyle } from '../utils/analyzerUtils.js';
import { Spinner } from '../../../components/Spinner.jsx';

export function EmptyState({ loading }) {
  if (loading) {
    return (
      <div className='flex min-h-[20vh] items-center justify-center p-8'>
        <Spinner />
      </div>
    );
  }
  return (
    <div className='flex min-h-[60vh] items-center justify-center p-8'>
      <div className='max-w-2xl space-y-8 text-center'>
        {/* Headline */}
        <div className='space-y-2'>
          <h2 className='text-base-content text-2xl font-bold'>No Shot Loaded</h2>
          <p className='text-base-content opacity-70'>
            Import a shot file or select one from your library to start analyzing.
          </p>
        </div>

        {/* Info Box */}
        <div className='bg-base-200/60 border-base-content/5 space-y-6 rounded-xl border p-8 text-left shadow-sm'>
          <p className='text-base-content border-base-content/10 mb-4 border-b pb-2 text-sm font-bold tracking-wide uppercase'>
            Supported Sources
          </p>

          {/* GM Section */}
          <div className='flex items-start gap-4'>
            {/* MATCHED LIBRARY COLOR: Changed from cyan-500 to blue-500 */}
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center rounded border border-blue-500/20 bg-blue-500/10'>
              <span className='text-[10px] font-black tracking-tighter text-blue-500'>GM</span>
            </div>

            <div className='flex-1'>
              {/* REMOVED HOVER EFFECT */}
              <h3 className='text-base-content mb-1 text-sm font-bold'>GaggiMate Controller</h3>
              <p className='text-base-content text-xs leading-relaxed'>
                Your saved shots and profiles directly from the controller's internal storage.
              </p>
            </div>
          </div>

          {/* Divider - Subtle */}
          <div className='bg-base-content/5 h-px w-full'></div>

          {/* WEB Section */}
          <div className='flex items-start gap-4'>
            <div className='flex h-8 w-10 flex-shrink-0 items-center justify-center rounded border border-purple-500/20 bg-purple-500/10'>
              <span className='text-[10px] font-black tracking-tighter text-purple-500'>WEB</span>
            </div>

            <div className='flex-1'>
              {/* REMOVED HOVER EFFECT */}
              <h3 className='text-base-content mb-1 text-sm font-bold'>Local Browser Storage</h3>
              <div className='text-base-content text-xs leading-relaxed'>
                External{' '}
                <code className='bg-base-100 border-base-content/10 mx-0.5 rounded border px-1 py-0.5 font-mono text-[10px] text-purple-500'>
                  .json
                </code>{' '}
                files.
                <span className='mt-1 block'>
                  Drag & Drop files or use the Import button. Bulk upload is supported.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Logo: Masked Div for Theme Color Adaptation */}
        <div className='bg-base-content mx-auto h-24 w-24 opacity-20' style={maskStyle} />

        {/* Tip */}
        <div className='text-base-content pt-2 text-xs opacity-50'>
          Tip: You can toggle between{' '}
          <span className='font-bold opacity-100'>VIEW Temporarily or SAVE in Browser</span>.
        </div>
      </div>
    </div>
  );
}
