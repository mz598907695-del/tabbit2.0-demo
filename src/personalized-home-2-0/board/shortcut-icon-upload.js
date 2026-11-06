export const SHORTCUT_ICON_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 256;
const MAX_SOURCE_EDGE = 8192;
const MAX_SOURCE_PIXELS = 16 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|ico)$/i;

function validateFile(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('图片为空，请重新选择');
  if (file.size > MAX_FILE_BYTES) throw new Error('请选择 5 MB 以内的图片');
  const type = String(file.type || '').toLowerCase().split(';')[0].trim();
  // Some local pickers omit the MIME type, especially for ICO files.
  if (!IMAGE_TYPES.has(type) && !(!type && IMAGE_EXTENSION.test(file.name || ''))) {
    throw new Error('请选择 PNG、JPG、WebP、GIF、SVG 或 ICO 图片');
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error) => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const timeout = setTimeout(() => finish(new Error('图片读取超时，请更换图片')), 10000);
    image.onload = () => finish();
    image.onerror = () => finish(new Error('无法读取这张图片，请更换图片'));
    image.src = url;
  });
}

/** Decode and normalize entirely on-device; only a small raster is persisted. */
export async function readShortcutIcon(file) {
  validateFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error('图片尺寸无效，请更换图片');
    if (width > MAX_SOURCE_EDGE || height > MAX_SOURCE_EDGE || width * height > MAX_SOURCE_PIXELS) {
      throw new Error('图片尺寸过大，请先缩小后再上传');
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理图片，请重试');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    try {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/png');
      if (!data.startsWith('data:image/png;base64,')) throw new Error();
      return data;
    } catch {
      throw new Error('无法处理这张图片，请换用 PNG 或 JPG 图片');
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
