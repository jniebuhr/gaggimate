import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { useState } from 'preact/hooks';

export function ProfileAddCard({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = e => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = e => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const mockEvent = {
        target: {
          files: e.dataTransfer.files,
        },
      };
      onUpload(mockEvent);
    }
  };

  return (
    <Card sm={12} role='listitem'>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 transition-all duration-200 ${
          isDragging
            ? 'bg-primary/10 border-primary border-dashed'
            : 'border-base-300/50 hover:border-primary/50 bg-base-200/30'
        }`}
      >
        <a
          href='/profiles/new'
          className={`text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-3 p-8 transition-colors ${
            isDragging ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <FontAwesomeIcon
            icon={isDragging ? faUpload : faPlus}
            className={`mb-1 text-4xl transition-transform ${isDragging ? 'text-primary scale-110' : 'text-base-content/70'}`}
          />

          <div className='flex flex-col items-center text-center'>
            <span className='text-lg font-bold tracking-tight'>
              {isDragging ? 'Drop to import' : 'Add New Profile'}
            </span>

            {!isDragging && (
              <div className='bg-base-100/50 border-base-300/50 mt-2 rounded-full border px-4 py-1'>
                <span className='text-base-content/70 text-sm font-medium'>
                  or drag and drop <span className='text-primary/80 font-semibold'>.json</span> or{' '}
                  <span className='text-primary/80 font-semibold'>.tcl</span> files here
                </span>
              </div>
            )}
          </div>
        </a>
      </div>
    </Card>
  );
}
