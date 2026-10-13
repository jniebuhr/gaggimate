import { computed } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { machine } from '../../services/ApiService.js';
import {
  ACCEPTED_IMAGE_TYPES,
  canvasToDeviceImage,
  deleteProfileImage,
  deviceImageToCanvas,
  drawToCanvas,
  fetchProfileImage,
  isGif,
  uploadProfileImage,
} from '../../utils/profileImage.js';
import { Trans, useLingui } from '@lingui/react/macro';

const sdCard = computed(() => !!machine.value.capabilities.sdCard);

export function ProfileImageUpload({ profileId }) {
  const { t } = useLingui();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const hasSdCard = sdCard.value;

  useEffect(() => {
    if (!hasSdCard || !profileId) return;
    let cancelled = false;
    fetchProfileImage(profileId)
      .then(buffer => {
        if (!cancelled) setPreview(buffer ? deviceImageToCanvas(buffer).toDataURL() : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profileId, hasSdCard]);

  const onFile = useCallback(
    async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setError('');
      if (await isGif(file, file.name)) {
        setError(t`GIF images are not supported. Please use PNG, JPEG, WebP or BMP.`);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setError(t`Unsupported file type. Please use PNG, JPEG, WebP or BMP.`);
        return;
      }
      setBusy(true);
      try {
        const canvas = await drawToCanvas(file);
        await uploadProfileImage(profileId, canvasToDeviceImage(canvas));
        setPreview(canvas.toDataURL());
      } catch (err) {
        setError(err.message || t`Could not read this image.`);
      } finally {
        setBusy(false);
      }
    },
    [profileId, t],
  );

  const onRemove = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await deleteProfileImage(profileId);
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [profileId]);

  if (!hasSdCard) return null;

  return (
    <div className='form-control'>
      <label htmlFor='profile-image' className='mb-2 block text-sm font-medium'>
        <Trans>Image</Trans>
      </label>
      {!profileId ? (
        <p className='text-sm opacity-70'>
          <Trans>Save the profile first to add an image.</Trans>
        </p>
      ) : (
        <div className='flex flex-row items-start gap-4'>
          <div className='bg-base-200 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded'>
            {preview ? (
              <img src={preview} alt={t`Profile image`} className='h-full w-full object-cover' />
            ) : (
              <span className='text-xs opacity-50'>
                <Trans>No image</Trans>
              </span>
            )}
          </div>
          <div className='flex min-w-0 flex-col gap-2'>
            <div className='flex flex-row flex-wrap gap-2'>
              <input
                ref={inputRef}
                id='profile-image'
                type='file'
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                className='hidden'
                onChange={onFile}
              />
              <button
                type='button'
                className='btn btn-sm'
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {preview ? t`Replace image` : t`Upload image`}
              </button>
              {preview && (
                <button
                  type='button'
                  className='btn btn-sm btn-ghost'
                  disabled={busy}
                  onClick={onRemove}
                >
                  <Trans>Remove</Trans>
                </button>
              )}
            </div>
            <p className='text-xs opacity-70'>
              <Trans>
                PNG, JPEG, WebP or BMP. GIFs are not supported. The image is cropped to a square and
                scaled to 300×300 pixels for the display.
              </Trans>
            </p>
            {error && <p className='text-error text-xs'>{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
