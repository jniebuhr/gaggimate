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

export function PluginsTabSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Section key={i}>
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

export function BluetoothTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='skeleton h-6 w-32 rounded-md opacity-70'></div>}>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='skeleton h-4 w-48 rounded-md opacity-50'></div>
          <div className='skeleton h-10 w-32 rounded-lg opacity-85'></div>
        </div>
        <div className='mt-6 space-y-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
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

export function AnalysisSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Filters/Actions area skeleton */}
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex gap-2'>
          <div className='skeleton h-10 w-24 rounded-lg opacity-80'></div>
          <div className='skeleton h-10 w-24 rounded-lg opacity-80'></div>
        </div>
        <div className='skeleton h-10 w-36 rounded-lg opacity-80'></div>
      </div>

      {/* Main card representation */}
      <Section>
        {/* Table skeleton */}
        <div className='w-full overflow-x-auto'>
          <table className='table w-full'>
            <thead>
              <tr>
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i}>
                    <div className='skeleton h-4 w-16 rounded opacity-50'></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j}>
                      <div
                        className={`skeleton h-4 rounded opacity-40 ${j === 0 ? 'w-24' : j === 1 ? 'w-12' : j === 2 ? 'w-16' : 'w-20'}`}
                      ></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

export function ProfileListSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Section key={i} className='col-span-12'>
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

export function ShotHistorySkeleton() {
  return (
    <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Section key={i} className='col-span-12'>
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
