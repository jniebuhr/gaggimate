import Section from '../Card.jsx';

// Helper component for an input group skeleton
function InputSkeleton() {
  return (
    <div className='form-control space-y-2'>
      <div className='skeleton h-4 w-28 rounded-md opacity-60' />
      <div className='skeleton border-base-content/10 h-12 w-full rounded-md border' />
    </div>
  );
}

// Helper component for a toggle input skeleton
function ToggleSkeleton() {
  return (
    <div className='flex items-center justify-between py-2'>
      <div className='skeleton h-4 w-32 rounded-md opacity-60' />
      <div className='skeleton h-6 w-12 rounded-full opacity-80' />
    </div>
  );
}

export function GeneralTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-36 rounded-md opacity-70' />}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
        </div>
        <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
          <div className='skeleton h-5 w-48 rounded-md opacity-70' />
          <div className='skeleton h-4 w-5/6 rounded-md opacity-40' />
          <ToggleSkeleton />
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <InputSkeleton />
            <InputSkeleton />
          </div>
        </div>
      </Section>

      <Section title={<div className='skeleton h-6 w-40 rounded-md opacity-70' />}>
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
      <Section title={<div className='skeleton h-6 w-44 rounded-md opacity-70' />}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
        </div>
      </Section>

      <Section title={<div className='skeleton h-6 w-36 rounded-md opacity-70' />}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
        </div>
        <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
          <div className='skeleton h-5 w-40 rounded-md opacity-70' />
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <InputSkeleton />
            <InputSkeleton />
          </div>
        </div>
      </Section>
    </div>
  );
}

export function PluginsTabSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Section key={`plugin-skel-${i}`}>
          <div className='flex items-start gap-4'>
            <div className='skeleton border-base-content/10 h-12 w-12 shrink-0 rounded-xl border' />
            <div className='flex-1 space-y-2'>
              <div className='skeleton h-5 w-32 rounded-md opacity-80' />
              <div className='skeleton h-4 w-full rounded-md opacity-40' />
              <div className='skeleton h-4 w-5/6 rounded-md opacity-40' />
            </div>
          </div>
          <div className='border-base-content/5 mt-4 flex items-center justify-between border-t pt-4'>
            <div className='skeleton h-4 w-24 rounded-md opacity-40' />
            <div className='skeleton h-8 w-20 rounded-md opacity-80' />
          </div>
        </Section>
      ))}
    </div>
  );
}

export function BluetoothTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-32 rounded-md opacity-70' />}>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='skeleton h-4 w-48 rounded-md opacity-50' />
          <div className='skeleton h-10 w-32 rounded-lg opacity-85' />
        </div>
        <div className='mt-6 space-y-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`bluetooth-skel-${i}`}
              className='border-base-content/5 bg-base-200/20 flex items-center justify-between rounded-lg border p-3'
            >
              <div className='flex items-center gap-3'>
                <div className='skeleton h-8 w-8 shrink-0 rounded-full opacity-50' />
                <div className='space-y-2'>
                  <div className='skeleton h-4 w-28 rounded opacity-80' />
                  <div className='skeleton h-3 w-40 rounded opacity-40' />
                </div>
              </div>
              <div className='skeleton h-8 w-20 rounded-md opacity-60' />
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
        <Section title={<div className='skeleton h-6 w-24 rounded-md opacity-70' />}>
          <div className='skeleton mb-4 h-4 w-5/6 rounded opacity-40' />
          <div className='skeleton border-base-content/20 flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed'>
            <div className='skeleton h-8 w-8 rounded-full opacity-40' />
            <div className='skeleton h-4 w-36 rounded opacity-50' />
          </div>
        </Section>

        <Section title={<div className='skeleton h-6 w-32 rounded-md opacity-70' />}>
          <div className='skeleton mb-6 h-4 w-5/6 rounded opacity-40' />
          <div className='space-y-3'>
            <div className='skeleton h-11 w-full rounded-lg opacity-80' />
            <div className='skeleton h-11 w-full rounded-lg opacity-85' />
          </div>
        </Section>
      </div>
    </div>
  );
}
