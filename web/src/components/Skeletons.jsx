import Section from './Card.jsx';

// Helper component for an input group skeleton
function InputSkeleton() {
  return (
    <div className='form-control space-y-2'>
      <div className='h-4 w-28 skeleton rounded-md opacity-60'></div>
      <div className='h-12 w-full skeleton rounded-md border border-base-content/10'></div>
    </div>
  );
}

// Helper component for a toggle input skeleton
function ToggleSkeleton() {
  return (
    <div className='flex items-center justify-between py-2'>
      <div className='h-4 w-32 skeleton rounded-md opacity-60'></div>
      <div className='h-6 w-12 skeleton rounded-full opacity-80'></div>
    </div>
  );
}

export function GeneralTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='h-6 w-36 skeleton rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
        </div>
        <div className='mt-6 border-t border-base-content/5 pt-6 space-y-4'>
          <div className='h-5 w-48 skeleton rounded-md opacity-70'></div>
          <div className='h-4 w-5/6 skeleton rounded-md opacity-40'></div>
          <ToggleSkeleton />
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <InputSkeleton />
            <InputSkeleton />
          </div>
        </div>
      </Section>

      <Section title={<div className='h-6 w-40 skeleton rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
      <Section title={<div className='h-6 w-44 skeleton rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <InputSkeleton />
          <InputSkeleton />
        </div>
      </Section>

      <Section title={<div className='h-6 w-36 skeleton rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
          <InputSkeleton />
        </div>
        <div className='mt-6 border-t border-base-content/5 pt-6 space-y-4'>
          <div className='h-5 w-40 skeleton rounded-md opacity-70'></div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Section key={i}>
          <div className='flex gap-4 items-start'>
            <div className='w-12 h-12 rounded-xl skeleton shrink-0 border border-base-content/10'></div>
            <div className='flex-1 space-y-2'>
              <div className='h-5 w-32 skeleton rounded-md opacity-80'></div>
              <div className='h-4 w-full skeleton rounded-md opacity-40'></div>
              <div className='h-4 w-5/6 skeleton rounded-md opacity-40'></div>
            </div>
          </div>
          <div className='mt-4 flex justify-between items-center border-t border-base-content/5 pt-4'>
            <div className='h-4 w-24 skeleton rounded-md opacity-40'></div>
            <div className='h-8 w-20 skeleton rounded-md opacity-80'></div>
          </div>
        </Section>
      ))}
    </div>
  );
}

export function BluetoothTabSkeleton() {
  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={<div className='h-6 w-32 skeleton rounded-md opacity-70'></div>}>
        <div className='flex flex-wrap gap-4 items-center justify-between'>
          <div className='h-4 w-48 skeleton rounded-md opacity-50'></div>
          <div className='h-10 w-32 skeleton rounded-lg opacity-85'></div>
        </div>
        <div className='mt-6 space-y-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='flex items-center justify-between p-3 rounded-lg border border-base-content/5 bg-base-200/20'>
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 rounded-full skeleton opacity-50 shrink-0'></div>
                <div className='space-y-2'>
                  <div className='h-4 w-28 skeleton rounded opacity-80'></div>
                  <div className='h-3 w-40 skeleton rounded opacity-40'></div>
                </div>
              </div>
              <div className='h-8 w-20 skeleton rounded-md opacity-60'></div>
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
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6'>
        <Section title={<div className='h-6 w-24 skeleton rounded-md opacity-70'></div>}>
          <div className='h-4 w-5/6 skeleton rounded opacity-40 mb-4'></div>
          <div className='h-32 w-full skeleton rounded-lg border border-dashed border-base-content/20 flex flex-col items-center justify-center gap-2'>
            <div className='w-8 h-8 rounded-full skeleton opacity-40'></div>
            <div className='h-4 w-36 skeleton rounded opacity-50'></div>
          </div>
        </Section>

        <Section title={<div className='h-6 w-32 skeleton rounded-md opacity-70'></div>}>
          <div className='h-4 w-5/6 skeleton rounded opacity-40 mb-6'></div>
          <div className='space-y-3'>
            <div className='h-11 w-full skeleton rounded-lg opacity-80'></div>
            <div className='h-11 w-full skeleton rounded-lg opacity-85'></div>
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
          <div className='h-10 w-24 skeleton rounded-lg opacity-80'></div>
          <div className='h-10 w-24 skeleton rounded-lg opacity-80'></div>
        </div>
        <div className='h-10 w-36 skeleton rounded-lg opacity-80'></div>
      </div>

      {/* Main card representation */}
      <Section>
        {/* Table skeleton */}
        <div className='overflow-x-auto w-full'>
          <table className='table w-full'>
            <thead>
              <tr>
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i}>
                    <div className='h-4 w-16 skeleton rounded opacity-50'></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j}>
                      <div className={`h-4 skeleton rounded opacity-40 ${j === 0 ? 'w-24' : j === 1 ? 'w-12' : j === 2 ? 'w-16' : 'w-20'}`}></div>
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
        <Section key={i} className="col-span-12">
          <div className='flex flex-col gap-4'>
             <div className='flex gap-4 items-center'>
                <div className='w-5 h-5 skeleton rounded opacity-60'></div>
                <div className='h-6 w-48 skeleton rounded opacity-80'></div>
                <div className='h-5 w-16 skeleton rounded-full opacity-60'></div>
             </div>
             <div className='h-24 w-full skeleton rounded-lg opacity-30 mt-2'></div>
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
        <Section key={i} className="col-span-12">
          <div className='flex flex-col md:flex-row gap-4'>
             <div className='w-full md:w-32 h-24 skeleton rounded-lg opacity-40 shrink-0'></div>
             <div className='flex-1 space-y-3 py-2'>
                <div className='flex justify-between items-center'>
                   <div className='h-5 w-48 skeleton rounded opacity-80'></div>
                   <div className='h-6 w-16 skeleton rounded-full opacity-60'></div>
                </div>
                <div className='h-4 w-32 skeleton rounded opacity-50'></div>
                <div className='flex gap-2 mt-4'>
                   <div className='h-6 w-20 skeleton rounded-badge opacity-60'></div>
                   <div className='h-6 w-20 skeleton rounded-badge opacity-60'></div>
                   <div className='h-6 w-20 skeleton rounded-badge opacity-60'></div>
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
      <Section title={<div className='h-6 w-36 skeleton rounded-md opacity-70'></div>}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control space-y-2'>
            <div className='h-4 w-28 skeleton rounded-md opacity-60'></div>
            <div className='h-12 w-full skeleton rounded-md border border-base-content/10'></div>
          </div>
          <div className='form-control space-y-2'>
            <div className='h-4 w-28 skeleton rounded-md opacity-60'></div>
            <div className='h-12 w-full skeleton rounded-md border border-base-content/10'></div>
          </div>
        </div>
        <div className='mt-6 border-t border-base-content/5 pt-6 space-y-4'>
           <div className='h-32 w-full skeleton rounded-lg opacity-40'></div>
        </div>
      </Section>
    </div>
  );
}
