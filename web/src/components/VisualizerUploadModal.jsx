import { useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';

export default function VisualizerUploadModal({ 
  isOpen, 
  onClose, 
  onUpload, 
  isUploading = false,
  shotInfo 
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);

  const handleSubmit = async (e) => {
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
        localStorage.setItem('visualizer_remember', 'true');
      } else {
        localStorage.removeItem('visualizer_username');
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
  useState(() => {
    if (isOpen) {
      const savedUsername = localStorage.getItem('visualizer_username');
      const savedRemember = localStorage.getItem('visualizer_remember') === 'true';
      
      if (savedRemember && savedUsername) {
        setUsername(savedUsername);
        setRememberCredentials(true);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Upload to Visualizer.coffee</h3>
            {!isUploading && (
              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>

          {shotInfo && (
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Shot:</strong> {shotInfo.profile}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Date:</strong> {new Date(shotInfo.timestamp * 1000).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Duration:</strong> {(shotInfo.duration / 1000).toFixed(1)}s
              </p>
              {shotInfo.volume > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Yield:</strong> {shotInfo.volume}g
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                Visualizer.coffee Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isUploading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
                disabled={isUploading}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                Remember username
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !username.trim() || !password.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center space-x-2"
              >
                {isUploading && <FontAwesomeIcon icon={faSpinner} spin />}
                <span>{isUploading ? 'Uploading...' : 'Upload Shot'}</span>
              </button>
            </div>
          </form>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p>
              Your credentials are only used for this upload and will be stored locally only if you choose to remember your username.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
