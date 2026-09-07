import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons/faExclamationTriangle';
import { useState } from 'preact/hooks';

export function ProfileAddCard({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);

  const allowedExtensions = ['.json', '.tcl'];

  const validateFileContent = async file => {
    // Check file extension
    const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExtension) {
      setError(`Only ${allowedExtensions.join(' or ')} files are supported.`);
      return false;
    }

    // Check internal JSON structure
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validation check for required fields (e.g., label and phases)
        if (!data.label || !Array.isArray(data.phases)) {
          setError('Invalid Profile: File is missing required coffee profile data.');
          return false;
        }
      } catch (e) {
        setError('Invalid JSON: The file is corrupted or not a valid JSON.');
        return false;
      }
    }

    setError(null);
    return true;
  };

  const onDragOver = e => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
    setError(null);
  };

  const onDrop = async e => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const isValid = await validateFileContent(file);

      if (isValid) {
        const mockEvent = { target: { files } };
        onUpload(mockEvent);
      }
    }
  };

  return (
    <Card sm={12} role='listitem'>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 transition-all duration-200 ${
          error
            ? 'bg-error/10 border-error border-dashed'
            : isDragging
              ? 'bg-primary/10 border-primary border-dashed'
              : 'border-base-300/50 hover:border-primary/50 bg-base-200/30'
        }`}
      >
        <a
          href='/profiles/new'
          className={`text-base-content flex cursor-pointer flex-col items-center justify-center gap-3 p-8 transition-colors ${
            isDragging ? 'pointer-events-none opacity-50' : 'hover:text-primary'
          }`}
        >
          <FontAwesomeIcon
            icon={error ? faExclamationTriangle : isDragging ? faUpload : faPlus}
            className={`mb-1 text-4xl transition-transform ${
              error
                ? 'text-error animate-pulse'
                : isDragging
                  ? 'text-primary scale-110'
                  : 'text-base-content/70'
            }`}
          />

          <div className='flex flex-col items-center text-center'>
            <span className={`text-lg font-bold tracking-tight ${error ? 'text-error' : ''}`}>
              {error ? 'Invalid file' : isDragging ? 'Drop to import' : 'Add New Profile'}
            </span>

            <div
              className={`mt-2 rounded-full border px-4 py-1 transition-colors ${
                error ? 'bg-error/20 border-error/50' : 'bg-base-100/50 border-base-300/50'
              }`}
            >
              <span
                className={`text-sm font-medium ${error ? 'text-error' : 'text-base-content/70'}`}
              >
                {error ? (
                  error
                ) : (
                  <>
                    or drag and drop <span className='text-primary/80 font-semibold'>.json</span> or{' '}
                    <span className='text-primary/80 font-semibold'>.tcl</span> files here
                  </>
                )}
              </span>
            </div>
          </div>
        </a>
      </div>
    </Card>
  );
}
