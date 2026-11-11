import { useEffect, useId, useRef } from 'preact/hooks';
import { useLingui } from '@lingui/react/macro';

export default function ConfirmDeleteModal({
  title,
  description,
  confirmLabel,
  busyLabel,
  descriptionClassName = 'mb-4 text-sm text-gray-600 dark:text-gray-300',
  busy = false,
  progress = null,
  progressClassName = 'progress-error',
  onClose,
  onConfirm,
  onCancelBusy,
}) {
  const { t } = useLingui();
  const titleId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (busy) return;
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  return (
    <div className='bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4'>
      {/* Native <dialog> opened via the open attribute: the overlay div keeps
          the visual backdrop and the reset classes undo the UA border/padding,
          so the layout is unchanged while assistive tech gets real semantics. */}
      <dialog
        open
        aria-modal='true'
        aria-labelledby={titleId}
        className='static m-0 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border-none bg-white p-0 shadow-xl dark:bg-gray-800'
      >
        <div className='p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 id={titleId} className='text-lg font-semibold'>
              {title}
            </h3>
            {!busy && (
              <button
                onClick={onClose}
                className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                aria-label={t`Close`}
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
                  ? t`Deleting shot ${progress.current} of ${progress.total}...`
                  : t`Preparing deletion...`}
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
                {t`Cancel deletion`}
              </button>
            ) : (
              <>
                <button
                  ref={cancelRef}
                  type='button'
                  onClick={onClose}
                  disabled={busy}
                  className='rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                >
                  {t`Cancel`}
                </button>
                <button
                  type='button'
                  onClick={onConfirm}
                  disabled={busy}
                  className='rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                >
                  {busy ? (busyLabel ?? t`Deleting…`) : confirmLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
