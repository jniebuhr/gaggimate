export default function ModalHeader({ busy, onClose }) {
  return (
    <div className='mb-4 flex items-center justify-between'>
      <h3 className='text-lg font-semibold'>Pump Flow Calibration</h3>
      {!busy && (
        <button
          type='button'
          onClick={onClose}
          className='btn btn-ghost btn-sm btn-circle'
          aria-label='Close'
        >
          ✕
        </button>
      )}
    </div>
  );
}
