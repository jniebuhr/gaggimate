export function Storage() {
  return (
    <div className='space-y-6'>
      <div className='card bg-base-100 shadow-xl'>
        <div className='card-body'>
          <div className='max-w-3xl'>
            <h1 className='card-title text-3xl'>Storage</h1>

            <p className='text-base-content/70 mt-3 text-base'>
              Protect your coffee history and profiles by creating backups you can restore later.
            </p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
        <div className='card bg-base-100 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title'>Create Backup</h2>

            <p className='text-base-content/70'>Save a backup copy of your coffee data.</p>

            <div className='card-actions mt-4'>
              <button type='button' className='btn btn-primary w-full sm:w-auto' disabled>
                Create Backup
              </button>
            </div>
          </div>
        </div>

        <div className='card bg-base-100 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title'>Restore Backup</h2>

            <p className='text-base-content/70'>Restore coffee data from a backup file.</p>

            <div className='card-actions mt-4'>
              <button type='button' className='btn btn-primary w-full sm:w-auto' disabled>
                Restore Backup
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='card bg-base-100 shadow-xl'>
        <div className='card-body'>
          <h2 className='card-title'>Archive Information</h2>

          <p className='text-base-content/60 text-sm'>
            Backup activity will appear here after backups are created or restored.
          </p>
        </div>
      </div>
    </div>
  );
}
