import { computed } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { machine } from '../../services/ApiService.js';

// Device format: 4-byte LVGL header (true color, 300x300) + RGB565 little endian pixels.
const IMAGE_SIZE = 300;
const COLOR_FORMAT_TRUE_COLOR = 4;
const HEADER = COLOR_FORMAT_TRUE_COLOR | (IMAGE_SIZE << 10) | (IMAGE_SIZE << 21);
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];

const sdCard = computed(() => !!machine.value.capabilities.sdCard);

const imageUrl = id => `/api/profiles/image?id=${encodeURIComponent(id)}`;

async function isGif(file) {
  if (file.type === 'image/gif' || /\.gif$/i.test(file.name)) return true;
  const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return String.fromCharCode(...magic) === 'GIF8';
}

// Center-crop to a square and scale to 300x300.
async function drawToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    IMAGE_SIZE,
    IMAGE_SIZE,
  );
  bitmap.close();
  return canvas;
}

function canvasToDeviceImage(canvas) {
  const px = canvas.getContext('2d').getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
  const out = new DataView(new ArrayBuffer(4 + IMAGE_SIZE * IMAGE_SIZE * 2));
  out.setUint32(0, HEADER, true);
  for (let i = 0, o = 4; i < px.length; i += 4, o += 2) {
    out.setUint16(o, ((px[i] & 0xf8) << 8) | ((px[i + 1] & 0xfc) << 3) | (px[i + 2] >> 3), true);
  }
  return out.buffer;
}

function deviceImageToDataUrl(buffer) {
  const view = new DataView(buffer);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(IMAGE_SIZE, IMAGE_SIZE);
  for (let i = 0, o = 4; o + 1 < buffer.byteLength; i += 4, o += 2) {
    const v = view.getUint16(o, true);
    image.data[i] = (((v >> 11) & 0x1f) * 255) / 31;
    image.data[i + 1] = (((v >> 5) & 0x3f) * 255) / 63;
    image.data[i + 2] = ((v & 0x1f) * 255) / 31;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function ProfileImageUpload({ profileId }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const hasSdCard = sdCard.value;

  useEffect(() => {
    if (!hasSdCard || !profileId) return;
    let cancelled = false;
    fetch(imageUrl(profileId), { cache: 'no-store' })
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(buffer => {
        if (!cancelled) setPreview(buffer ? deviceImageToDataUrl(buffer) : null);
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
      if (await isGif(file)) {
        setError('GIF images are not supported. Please use PNG, JPEG, WebP or BMP.');
        return;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Unsupported file type. Please use PNG, JPEG, WebP or BMP.');
        return;
      }
      setBusy(true);
      try {
        const canvas = await drawToCanvas(file);
        const response = await fetch(imageUrl(profileId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: canvasToDeviceImage(canvas),
        });
        if (!response.ok) throw new Error((await response.text()) || 'Upload failed');
        setPreview(canvas.toDataURL());
      } catch (err) {
        setError(err.message || 'Could not read this image.');
      } finally {
        setBusy(false);
      }
    },
    [profileId],
  );

  const onRemove = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(imageUrl(profileId), { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.text()) || 'Could not remove image');
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
        Image
      </label>
      {!profileId ? (
        <p className='text-sm opacity-70'>Save the profile first to add an image.</p>
      ) : (
        <div className='flex flex-row items-start gap-4'>
          <div className='bg-base-200 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded'>
            {preview ? (
              <img src={preview} alt='Profile image' className='h-full w-full object-cover' />
            ) : (
              <span className='text-xs opacity-50'>No image</span>
            )}
          </div>
          <div className='flex min-w-0 flex-col gap-2'>
            <div className='flex flex-row flex-wrap gap-2'>
              <input
                ref={inputRef}
                id='profile-image'
                type='file'
                accept={ACCEPTED_TYPES.join(',')}
                className='hidden'
                onChange={onFile}
              />
              <button
                type='button'
                className='btn btn-sm'
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {preview ? 'Replace image' : 'Upload image'}
              </button>
              {preview && (
                <button
                  type='button'
                  className='btn btn-sm btn-ghost'
                  disabled={busy}
                  onClick={onRemove}
                >
                  Remove
                </button>
              )}
            </div>
            <p className='text-xs opacity-70'>
              PNG, JPEG, WebP or BMP. GIFs are not supported. The image is cropped to a square and
              scaled to 300×300 pixels for the display.
            </p>
            {error && <p className='text-error text-xs'>{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
