// Profile images live on the device SD card as a 4-byte LVGL header (true color, 300x300) + RGB565 little endian pixels.
export const PROFILE_IMAGE_SIZE = 300;
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];

const COLOR_FORMAT_TRUE_COLOR = 4;
const HEADER = COLOR_FORMAT_TRUE_COLOR | (PROFILE_IMAGE_SIZE << 10) | (PROFILE_IMAGE_SIZE << 21);

const imageUrl = id => `/api/profiles/image?id=${encodeURIComponent(id)}`;

export async function isGif(blob, name = '') {
  if (blob.type === 'image/gif' || /\.gif$/i.test(name)) return true;
  const magic = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return String.fromCharCode(...magic) === 'GIF8';
}

// Center-crop to a square and scale to 300x300.
export async function drawToCanvas(blob) {
  const bitmap = await createImageBitmap(blob);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PROFILE_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
  );
  bitmap.close();
  return canvas;
}

export function canvasToDeviceImage(canvas) {
  const px = canvas
    .getContext('2d')
    .getImageData(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE).data;
  const out = new DataView(new ArrayBuffer(4 + PROFILE_IMAGE_SIZE * PROFILE_IMAGE_SIZE * 2));
  out.setUint32(0, HEADER, true);
  for (let i = 0, o = 4; i < px.length; i += 4, o += 2) {
    out.setUint16(o, ((px[i] & 0xf8) << 8) | ((px[i + 1] & 0xfc) << 3) | (px[i + 2] >> 3), true);
  }
  return out.buffer;
}

export function deviceImageToCanvas(buffer) {
  const view = new DataView(buffer);
  const canvas = document.createElement('canvas');
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
  for (let i = 0, o = 4; o + 1 < buffer.byteLength; i += 4, o += 2) {
    const v = view.getUint16(o, true);
    image.data[i] = (((v >> 11) & 0x1f) * 255) / 31;
    image.data[i + 1] = (((v >> 5) & 0x3f) * 255) / 63;
    image.data[i + 2] = ((v & 0x1f) * 255) / 31;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function fetchProfileImage(id) {
  const response = await fetch(imageUrl(id), { cache: 'no-store' });
  return response.ok ? response.arrayBuffer() : null;
}

export async function uploadProfileImage(id, buffer) {
  const response = await fetch(imageUrl(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  if (!response.ok) throw new Error((await response.text()) || 'Upload failed');
}

export async function deleteProfileImage(id) {
  const response = await fetch(imageUrl(id), { method: 'DELETE' });
  if (!response.ok) throw new Error((await response.text()) || 'Could not remove image');
}

// Export format: the "image" field of a profile, as a PNG data URL. Returns null when the profile has no image.
export async function exportProfileImage(id) {
  const buffer = await fetchProfileImage(id);
  return buffer ? deviceImageToCanvas(buffer).toDataURL('image/png') : null;
}

// Import from a data URL (GaggiMate "image" or Meticulous display.image); GIFs and other formats are skipped.
export async function importProfileImage(id, dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return false;
  const blob = await (await fetch(dataUrl)).blob();
  if ((await isGif(blob)) || !ACCEPTED_IMAGE_TYPES.includes(blob.type)) return false;
  const canvas = await drawToCanvas(blob);
  await uploadProfileImage(id, canvasToDeviceImage(canvas));
  return true;
}
