import Section from './Card.jsx';

// Helper component for an input group skeleton
function InputSkeleton() {
  return (
    <div className='form-control space-y-2'>
      <div className='skeleton h-4 w-28 rounded-md opacity-60'></div>
      <div className='skeleton border-base-content/10 h-12 w-full rounded-md border'></div>
    </div>
  );
}

// Helper component for a toggle input skeleton
function ToggleSkeleton() {
  return (
    <div className='flex items-center justify-between py-2'>
      <div className='skeleton h-4 w-32 rounded-md opacity-60'></div>
      <div className='skeleton h-6 w-12 rounded-full opacity-80'></div>
    </div>
  );
}

export function GeneralTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-36 rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
        </div>
        <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
          <div className='skeleton h-5 w-48 rounded-md opacity-70'></div>
          <div className='skeleton h-4 w-5/6 rounded-md opacity-40'></div>
          <ToggleSkeleton />
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <InputSkeleton />
            <InputSkeleton />
          </div>
        </div>
      </Section>

      <Section title={<div className='skeleton h-6 w-40 rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
        </div>
      </Section>
    </div>
  );
}

export function MachineTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-44 rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
        </div>
      </Section>

      <Section title={<div className='skeleton h-6 w-36 rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
        </div>
        <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
          <div className='skeleton h-5 w-40 rounded-md opacity-70'></div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <InputSkeleton />
            <InputSkeleton />
          </div>
        </div>
      </Section>
    </div>
  );
}

const PLUGIN_KEYS = ['plug1', 'plug2', 'plug3', 'plug4'];

export function PluginsTabSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      {PLUGIN_KEYS.map(key => (
        <Section key={key}>
          <div className='flex items-start gap-4'>
            <div className='skeleton border-base-content/10 h-12 w-12 shrink-0 rounded-xl border'></div>
            <div className='flex-1 space-y-2'>
              <div className='skeleton h-5 w-32 rounded-md opacity-80'></div>
              <div className='skeleton h-4 w-full rounded-md opacity-40'></div>
              <div className='skeleton h-4 w-5/6 rounded-md opacity-40'></div>
            </div>
          </div>
          <div className='border-base-content/5 mt-4 flex items-center justify-between border-t pt-4'>
            <div className='skeleton h-4 w-24 rounded-md opacity-40'></div>
            <div className='skeleton h-8 w-20 rounded-md opacity-80'></div>
          </div>
        </Section>
      ))}
    </div>
  );
}

const BT_KEYS = ['bt1', 'bt2', 'bt3'];

export function BluetoothTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-32 rounded-md opacity-70'></div>}>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='skeleton h-4 w-48 rounded-md opacity-50'></div>
          <div className='skeleton h-10 w-32 rounded-lg opacity-85'></div>
        </div>
        <div className='mt-6 space-y-3'>
          {BT_KEYS.map(key => (
            <div
              key={key}
              className='border-base-content/5 bg-base-200/20 flex items-center justify-between rounded-lg border p-3'
            >
              <div className='flex items-center gap-3'>
                <div className='skeleton h-8 w-8 shrink-0 rounded-full opacity-50'></div>
                <div className='space-y-2'>
                  <div className='skeleton h-4 w-28 rounded opacity-80'></div>
                  <div className='skeleton h-3 w-40 rounded opacity-40'></div>
                </div>
              </div>
              <div className='skeleton h-8 w-20 rounded-md opacity-60'></div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function SystemTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <div className='grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2'>
        <Section title={<div className='skeleton h-6 w-24 rounded-md opacity-70'></div>}>
          <div className='skeleton mb-4 h-4 w-5/6 rounded opacity-40'></div>
          <div className='skeleton border-base-content/20 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed'>
            <div className='skeleton h-8 w-8 rounded-full opacity-40'></div>
            <div className='skeleton h-4 w-36 rounded opacity-50'></div>
          </div>
        </Section>

        <Section title={<div className='skeleton h-6 w-32 rounded-md opacity-70'></div>}>
          <div className='skeleton mb-6 h-4 w-5/6 rounded opacity-40'></div>
          <div className='space-y-3'>
            <div className='skeleton h-11 w-full rounded-lg opacity-80'></div>
            <div className='skeleton h-11 w-full rounded-lg opacity-85'></div>
          </div>
        </Section>
      </div>
    </div>
  );
}

export { AnalysisSkeleton } from './skeletons/AnalysisSkeleton.jsx';

const PROFILE_KEYS = ['prof1', 'prof2', 'prof3', 'prof4'];

export function ProfileListSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
      {PROFILE_KEYS.map(key => (
        <Section key={key} className='col-span-12'>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center gap-4'>
              <div className='skeleton h-5 w-5 rounded opacity-60'></div>
              <div className='skeleton h-6 w-48 rounded opacity-80'></div>
              <div className='skeleton h-5 w-16 rounded-full opacity-60'></div>
            </div>
            <div className='skeleton mt-2 h-24 w-full rounded-lg opacity-30'></div>
          </div>
        </Section>
      ))}
    </div>
  );
}

const HISTORY_KEYS = ['hist1', 'hist2', 'hist3', 'hist4'];

export function ShotHistorySkeleton() {
  return (
    <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
      {HISTORY_KEYS.map(key => (
        <Section key={key} className='col-span-12'>
          <div className='flex flex-col gap-4 md:flex-row'>
            <div className='skeleton h-24 w-full shrink-0 rounded-lg opacity-40 md:w-32'></div>
            <div className='flex-1 space-y-3 py-2'>
              <div className='flex items-center justify-between'>
                <div className='skeleton h-5 w-48 rounded opacity-80'></div>
                <div className='skeleton h-6 w-16 rounded-full opacity-60'></div>
              </div>
              <div className='skeleton h-4 w-32 rounded opacity-50'></div>
              <div className='mt-4 flex gap-2'>
                <div className='skeleton rounded-badge h-6 w-20 opacity-60'></div>
                <div className='skeleton rounded-badge h-6 w-20 opacity-60'></div>
                <div className='skeleton rounded-badge h-6 w-20 opacity-60'></div>
              </div>
            </div>
          </div>
        </Section>
      ))}
    </div>
  );
}

export function ProfileEditSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-36 rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='form-control space-y-2'>
            <div className='skeleton h-4 w-28 rounded-md opacity-60'></div>
            <div className='skeleton border-base-content/10 h-12 w-full rounded-md border'></div>
          </div>
          <div className='form-control space-y-2'>
            <div className='skeleton h-4 w-28 rounded-md opacity-60'></div>
            <div className='skeleton border-base-content/10 h-12 w-full rounded-md border'></div>
          </div>
        </div>
        <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
          <div className='skeleton h-32 w-full rounded-lg opacity-40'></div>
        </div>
      </Section>
    </div>
  );
}
