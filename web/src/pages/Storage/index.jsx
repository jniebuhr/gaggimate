import { useState } from 'preact/hooks';

const REVIEW_ITEMS = [
  'Coffee shot history',
  'Profiles',
  'Notes and ratings',
  'Safe archive metadata',
];

export function Storage() {
  const [reviewingBackup, setReviewingBackup] = useState(false);

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

            {!reviewingBackup && (
              <div className='card-actions mt-4'>
                <button
                  type='button'
                  className='btn btn-primary w-full sm:w-auto'
                  onClick={() => setReviewingBackup(true)}
                >
                  Create Backup
                </button>
              </div>
            )}

            {reviewingBackup && (
              <div className='border-base-300 mt-5 rounded-box border p-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                  <div>
                    <h3 className='font-semibold'>Review Backup</h3>
                    <p className='text-base-content/60 mt-1 text-sm'>
                      Check what will be included before creating a backup.
                    </p>
                  </div>

                  <span className='badge badge-info'>Review</span>
                </div>

                <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
                  <div className='bg-base-200 rounded-box p-3'>
                    <div className='text-base-content/60 text-xs uppercase'>Shots</div>
                    <div className='mt-1 text-lg font-semibold'>Pending</div>
                  </div>

                  <div className='bg-base-200 rounded-box p-3'>
                    <div className='text-base-content/60 text-xs uppercase'>Profiles</div>
                    <div className='mt-1 text-lg font-semibold'>Pending</div>
                  </div>

                  <div className='bg-base-200 rounded-box p-3'>
                    <div className='text-base-content/60 text-xs uppercase'>Estimated Size</div>
                    <div className='mt-1 text-lg font-semibold'>Pending</div>
                  </div>
                </div>

                <div className='mt-4'>
                  <h4 className='text-sm font-semibold'>Backup contents</h4>
                  <ul className='text-base-content/70 mt-2 list-inside list-disc text-sm'>
                    {REVIEW_ITEMS.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className='card-actions mt-5 justify-end'>
                  <button
                    type='button'
                    className='btn btn-ghost w-full sm:w-auto'
                    onClick={() => setReviewingBackup(false)}
                  >
                    Back
                  </button>

                  <button type='button' className='btn btn-primary w-full sm:w-auto' disabled>
                    Create Backup
                  </button>
                </div>
              </div>
            )}
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
