export default function ConfirmDeleteModal({
  title,
  description,
  confirmLabel,
  busyLabel = 'Deleting…',
  progressLabel = 'Deleting shot',
  descriptionClassName = 'mb-4 text-sm text-gray-600 dark:text-gray-300',
  busy = false,
  progress = null,
  progressClassName = 'progress-error',
  onClose,
  onConfirm,
  onCancelBusy,
}) {
  return (
    <div className='bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4'>
      <div className='max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800'>
        <div className='p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>{title}</h3>
            {!busy && (
              <button
                onClick={onClose}
                className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                aria-label='Close'
              >
                ✕
              </button>
            )}
          </div>
          <p className={descriptionClassName}>{description}</p>
          {busy && progress && (
            <div className='mb-4 text-center'>
              <div className='mb-2 text-sm font-semibold opacity-70'>
                {progress.total > 0
                  ? `${progressLabel} ${progress.current} of ${progress.total}...`
                  : 'Preparing deletion...'}
              </div>
              {progress.total > 0 ? (
                <progress
                  className={`progress ${progressClassName} w-full max-w-xs`}
                  value={progress.current}
                  max={progress.total}
                />
              ) : (
                <progress className={`progress ${progressClassName} w-full max-w-xs`} />
              )}
            </div>
          )}
          <div className='flex justify-end space-x-3'>
            {busy && onCancelBusy ? (
              <button
                type='button'
                onClick={onCancelBusy}
                className='rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
              >
                Cancel deletion
              </button>
            ) : (
              <>
                <button
                  type='button'
                  onClick={onClose}
                  disabled={busy}
                  className='rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={onConfirm}
                  disabled={busy}
                  className='rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                >
                  {busy ? busyLabel : confirmLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
