import Section from '../Card.jsx';

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
