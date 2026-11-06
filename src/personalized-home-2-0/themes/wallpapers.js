export const WALLPAPER_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif';
export const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024;

const MIME_TYPES = new Set(WALLPAPER_ACCEPT.split(','));
const WALLPAPER_ID = /^wallpaper-[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const DATABASE_NAME = 'personalized-home-2-0-wallpapers';
const STORE_NAME = 'wallpapers';

export function isWallpaperTheme(id) {
  return typeof id === 'string' && WALLPAPER_ID.test(id);
}

export class WallpaperError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WallpaperError';
    this.code = code;
  }
}

export function getWallpaperErrorMessage(error) {
  if (error instanceof WallpaperError) return error.message;
  if (error?.name === 'QuotaExceededError') return '本地存储空间不足，请清理浏览器存储后重试';
  return '无法保存或读取本地壁纸，请重试';
}

function bytesMatch(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function textAt(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function detectMimeType(bytes) {
  if (bytesMatch(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (bytesMatch(bytes, [255, 216, 255])) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(textAt(bytes, 0, 6))) return 'image/gif';
  if (textAt(bytes, 0, 4) === 'RIFF' && textAt(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (textAt(bytes, 4, 4) === 'ftyp' && bytes.length >= 16) {
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const end = Math.min(boxSize || bytes.length, bytes.length);
    for (let offset = 8; offset + 4 <= end; offset += 4) {
      if (offset !== 12 && ['avif', 'avis'].includes(textAt(bytes, offset, 4))) return 'image/avif';
    }
  }
  return '';
}

export function decodeWallpaperImage(blob) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new WallpaperError('decode-unavailable', '当前浏览器无法读取图片，请更换浏览器后重试'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.src = '';
    };
    const timeout = setTimeout(() => finish(new WallpaperError('decode-timeout', '图片读取超时，请换一张图片重试')), 15000);
    image.onload = () => finish(image.naturalWidth && image.naturalHeight ? null : new Error('Invalid image dimensions'));
    image.onerror = () => finish(new Error('Image decoding failed'));
    image.src = url;
  });
}

/** Validate on-device without changing the original image or animated GIF. */
export async function validateWallpaperFile(file, { decode = decodeWallpaperImage } = {}) {
  if (!(file instanceof Blob) || !file.size) {
    throw new WallpaperError('empty', '图片为空，请重新选择');
  }
  if (file.size > MAX_WALLPAPER_BYTES) {
    throw new WallpaperError('too-large', '请选择 20 MB 以内的图片');
  }
  const mime = file.type.toLowerCase().split(';')[0].trim();
  if (!MIME_TYPES.has(mime)) {
    throw new WallpaperError('unsupported-type', '请选择 PNG、JPEG、WebP、AVIF 或 GIF 图片');
  }
  const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (detectMimeType(header) !== mime) {
    throw new WallpaperError('invalid-image', '图片格式与内容不符，请重新选择');
  }
  try {
    const dimensions = await decode(file);
    if (!(dimensions?.width > 0 && dimensions?.height > 0)) throw new Error('Invalid image dimensions');
  } catch (error) {
    if (error instanceof WallpaperError) throw error;
    throw new WallpaperError('decode-failed', '无法读取这张图片，请换一张图片重试');
  }
  const name = String(file.name || '').replace(/\.[^.]+$/, '').trim() || '我的壁纸';
  return { name, blob: file };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new WallpaperError('storage-unavailable', '当前浏览器不支持本地壁纸存储'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new WallpaperError('storage-blocked', '壁纸存储正被其他页面使用，请关闭其他页面后重试'));
    };
  });
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      let result;
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || request.error || new Error('Transaction aborted'));
    });
  } finally {
    database.close();
  }
}

export function isStoredWallpaper(record) {
  return Boolean(record && isWallpaperTheme(record.id) && typeof record.name === 'string'
    && record.name.trim() && record.blob instanceof Blob && record.blob.size > 0
    && record.blob.size <= MAX_WALLPAPER_BYTES && MIME_TYPES.has(record.blob.type)
    && Number.isFinite(record.createdAt));
}

export async function readWallpapers() {
  const records = await runTransaction('readonly', store => store.getAll());
  return records.filter(isStoredWallpaper).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveWallpaper(file) {
  const validated = await validateWallpaperFile(file);
  const record = {
    id: `wallpaper-${crypto.randomUUID()}`,
    ...validated,
    createdAt: Date.now(),
  };
  // Wait for commit before returning: a successful request alone can still be aborted.
  await runTransaction('readwrite', store => store.add(record));
  return record;
}

export async function deleteWallpaper(id) {
  if (!isWallpaperTheme(id)) {
    throw new WallpaperError('invalid-id', '无法识别这张壁纸，请刷新后重试');
  }
  try {
    await runTransaction('readwrite', store => store.delete(id));
    return true;
  } catch (error) {
    if (error instanceof WallpaperError) throw error;
    throw new WallpaperError('delete-failed', '无法删除这张壁纸，请重试');
  }
}
