import { useState, useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';

export default function VisualizerUploadModal({
  isOpen,
  onClose,
  onUpload,
  isUploading = false,
  shotInfo,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert('Please enter both username and password');
      return;
    }

    try {
      await onUpload(username.trim(), password, rememberCredentials);

      // Save credentials to localStorage if requested
      if (rememberCredentials) {
        localStorage.setItem('visualizer_username', username.trim());
        localStorage.setItem('visualizer_password', password);
        localStorage.setItem('visualizer_remember', 'true');
      } else {
        localStorage.removeItem('visualizer_username');
        localStorage.removeItem('visualizer_password');
        localStorage.removeItem('visualizer_remember');
      }

      // Clear form and close modal on success
      setUsername('');
      setPassword('');
      onClose();
    } catch (error) {
      // Error handling is done in parent component
      console.error('Upload failed:', error);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setUsername('');
      setPassword('');
      onClose();
    }
  };

  // Load saved credentials when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedUsername = localStorage.getItem('visualizer_username');
      const savedPassword = localStorage.getItem('visualizer_password');
      const savedRemember = localStorage.getItem('visualizer_remember') === 'true';

      if (savedRemember && savedUsername) {
        setUsername(savedUsername);
        setRememberCredentials(true);
        if (savedPassword) {
          setPassword(savedPassword);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className='bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4'>
      <div className='max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800'>
        <div className='p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>Upload to Visualizer.coffee</h3>
            {!isUploading && (
              <button
                onClick={handleClose}
                className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              >
                ✕
              </button>
            )}
          </div>

          {shotInfo && (
            <div className='mb-4 rounded-md bg-gray-100 p-3 dark:bg-gray-700'>
              <p className='text-sm text-gray-600 dark:text-gray-300'>
                <strong>Shot:</strong> {shotInfo.profile}
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-300'>
                <strong>Date:</strong> {new Date(shotInfo.timestamp * 1000).toLocaleString()}
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-300'>
                <strong>Duration:</strong> {(shotInfo.duration / 1000).toFixed(1)}s
              </p>
              {shotInfo.volume > 0 && (
                <p className='text-sm text-gray-600 dark:text-gray-300'>
                  <strong>Yield:</strong> {shotInfo.volume}g
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-4' name='visualizer-login' method='post'>
            <div className='outlined-field'>
              <label htmlFor='username' className='outlined-field-label'>
                Visualizer.coffee Username
              </label>
              <input
                id='username'
                name='username'
                type='text'
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isUploading}
                className='input input-bordered w-full'
                placeholder='Username'
                autoComplete='username'
                required
              />
            </div>

            <div className='outlined-field'>
              <label htmlFor='password' className='outlined-field-label'>
                Password
              </label>
              <div className='input w-full'>
                <input
                  id='password'
                  name='password'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isUploading}
                  className='grow'
                  placeholder='Password'
                  autoComplete='current-password'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isUploading}
                  className='text-base-content/50 hover:text-base-content cursor-pointer disabled:opacity-50'
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <div className='flex items-center'>
              <input
                id='remember'
                type='checkbox'
                checked={rememberCredentials}
                onChange={e => setRememberCredentials(e.target.checked)}
                disabled={isUploading}
                className='checkbox checkbox-sm'
              />
              <label htmlFor='remember' className='ml-2 text-sm opacity-70'>
                Remember credentials
              </label>
            </div>

            <div className='flex justify-end space-x-3 pt-4'>
              <button
                type='button'
                onClick={handleClose}
                disabled={isUploading}
                className='btn btn-ghost'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={isUploading || !username.trim() || !password.trim()}
                className='btn btn-primary'
              >
                {isUploading && <FontAwesomeIcon icon={faSpinner} spin />}
                <span>{isUploading ? 'Uploading...' : 'Upload Shot'}</span>
              </button>
            </div>
          </form>

          <div className='mt-4 text-xs text-gray-500 dark:text-gray-400'>
            <p>
              Your credentials are only used for this upload and will be stored locally only if you
              choose to remember your username.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
