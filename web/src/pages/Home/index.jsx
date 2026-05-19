export function Home() {
  return (
    <div className='grid grid-cols-1 gap-6 xl:grid-cols-12'>
      <div className='card bg-base-100 shadow-xl xl:col-span-8'>
        <div className='card-body flex min-h-[420px] items-center justify-center text-center'>
          <div>
            <div className='mb-6 text-6xl'>☕</div>

            <h1 className='mb-3 text-4xl font-bold'>Welcome to GaggiGo</h1>

            <p className='text-base-content/70 mb-2 text-lg'>
              Offline-first companion for GaggiMate.
            </p>

            <p className='text-base-content/60 max-w-2xl'>
              View profiles, analyse shot history, review settings, and safely sync data without
              exposing dangerous machine controls.
            </p>
          </div>
        </div>
      </div>

      <div className='card bg-base-100 shadow-xl xl:col-span-4'>
        <div className='card-body'>
          <h2 className='card-title'>System Status</h2>

          <div className='mt-4 space-y-4'>
            <div className='flex items-center justify-between'>
              <span>Frontend</span>
              <span className='badge badge-success'>ONLINE</span>
            </div>

            <div className='flex items-center justify-between'>
              <span>Local Cache</span>
              <span className='badge badge-info'>READY</span>
            </div>

            <div className='flex items-center justify-between'>
              <span>Sync Layer</span>
              <span className='badge badge-warning'>MVP</span>
            </div>

            <div className='divider'></div>

            <p className='text-base-content/60 text-sm'>
              GaggiGo never exposes brew, steam, grinder, water, or OTA controls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}