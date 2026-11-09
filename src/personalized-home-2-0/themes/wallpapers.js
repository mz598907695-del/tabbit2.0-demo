import { decodeWallpaperVideo, VIDEO_WALLPAPER_TYPES, VIDEO_POSTER_VERSION } from './wallpaper-video.js';

export const WALLPAPER_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm';
export const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_WALLPAPER_BYTES = 100 * 1024 * 1024;

const MIME_TYPES = new Set(WALLPAPER_ACCEPT.split(',').filter(type => !type.startsWith('.')));
const videoExtensions = { mp4:'video/mp4', mov:'video/quicktime', webm:'video/webm' };
const maximumBytes = mime => VIDEO_WALLPAPER_TYPES.has(mime) ? MAX_VIDEO_WALLPAPER_BYTES : MAX_WALLPAPER_BYTES;
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
    const brands = [];
    for (let offset = 8; offset + 4 <= end; offset += 4) {
      if (offset !== 12) brands.push(textAt(bytes, offset, 4));
    }
    if (brands.some(brand => ['avif', 'avis'].includes(brand))) return 'image/avif';
    if (brands.includes('qt  ')) return 'video/quicktime';
    if (brands.some(brand => /^(?:isom|iso[2-9]|mp4[12]|avc1|M4V |dash|MSNV)$/.test(brand))) return 'video/mp4';
  }
  if (bytesMatch(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && textAt(bytes, 4, bytes.length - 4).includes('webm')) return 'video/webm';
  if (['wide', 'moov', 'mdat'].includes(textAt(bytes, 4, 4))) return 'video/quicktime';
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

/** Validate locally, retaining original bytes. Videos also keep a decoded cover. */
export async function validateWallpaperFile(file, { decode } = {}) {
  if (!(file instanceof Blob) || !file.size) {
    throw new WallpaperError('empty', '文件为空，请重新选择');
  }
  const declaredMime = file.type.toLowerCase().split(';')[0].trim();
  const extension = String(file.name || '').split('.').at(-1).toLowerCase();
  const mime = declaredMime || videoExtensions[extension] || '';
  const video = VIDEO_WALLPAPER_TYPES.has(mime);
  if (file.size > maximumBytes(mime)) {
    throw new WallpaperError('too-large', video ? '请选择 100 MB 以内的视频' : '请选择 20 MB 以内的图片');
  }
  if (!MIME_TYPES.has(mime)) {
    throw new WallpaperError('unsupported-type', '请选择图片或 MP4、MOV、WebM 视频');
  }
  const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (detectMimeType(header) !== mime) {
    throw new WallpaperError('invalid-image', '文件格式与内容不符，请重新选择');
  }
  const blob = file.type === mime ? file : new Blob([file], { type:mime });
  let poster;
  try {
    const media = await (decode || (video ? decodeWallpaperVideo : decodeWallpaperImage))(blob);
    if (!(media?.width > 0 && media?.height > 0)) throw new Error('Invalid media dimensions');
    if (video) {
      if (!(media.poster instanceof Blob) || !media.poster.size || !media.poster.type.startsWith('image/')) throw new Error('Missing video cover');
      poster = media.poster;
    }
  } catch (error) {
    if (error instanceof WallpaperError) throw error;
    throw new WallpaperError('decode-failed', video ? '无法播放这个视频，请换一个 MP4、MOV 或 WebM 文件' : '无法读取这张图片，请换一张图片重试');
  }
  const name = String(file.name || '').replace(/\.[^.]+$/, '').trim() || '我的壁纸';
  return { name, blob, ...(poster ? { poster, posterVersion:VIDEO_POSTER_VERSION } : {}) };
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
      const request = operation(transaction.objectStore(STORE_NAME), value => { result = value; });
      if (request) request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = event => reject(transaction.error || event.target?.error || request?.error || new Error('Transaction failed'));
      transaction.onabort = () => reject(transaction.error || request?.error || new Error('Transaction aborted'));
    });
  } finally {
    database.close();
  }
}

export function isStoredWallpaper(record) {
  return Boolean(record && isWallpaperTheme(record.id) && typeof record.name === 'string'
    && record.name.trim() && record.blob instanceof Blob && record.blob.size > 0
    && record.blob.size <= maximumBytes(record.blob.type) && MIME_TYPES.has(record.blob.type)
    && (record.poster === undefined || (record.poster instanceof Blob && record.poster.size > 0 && record.poster.size <= MAX_WALLPAPER_BYTES && record.poster.type.startsWith('image/')))
    && Number.isFinite(record.createdAt));
}

export async function readWallpapers({ excludeIds } = {}) {
  const records = await runTransaction('readonly', (store, accept) => {
    if (!excludeIds?.size) return store.getAll();
    // Promoted official images remain in IndexedDB as migration backups.
    // Read their keys, not their blobs: only personal uploads need hydration.
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      const selected = [];
      accept(selected);
      for (const id of keys.result) {
        if (excludeIds.has(id)) continue;
        const request = store.get(id);
        request.onsuccess = () => selected.push(request.result);
      }
    };
  });
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

const posterRepairs = new Map();

/** Upgrade old black captures without re-uploading or resurrecting deleted items. */
export function refreshWallpaperVideoPoster(record, { decode = decodeWallpaperVideo } = {}) {
  if (!VIDEO_WALLPAPER_TYPES.has(record.blob.type) || (record.posterVersion === VIDEO_POSTER_VERSION && record.poster)) return Promise.resolve(record);
  if (posterRepairs.has(record.id)) return posterRepairs.get(record.id);
  const repair = (async () => {
    const { poster } = await decode(record.blob);
    return runTransaction('readwrite', (store, accept) => {
      const request = store.get(record.id);
      request.onsuccess = () => {
        const current = request.result;
        if (!current || (current.posterVersion === VIDEO_POSTER_VERSION && current.poster)) { accept(current || null); return; }
        const next = { ...current, poster, posterVersion:VIDEO_POSTER_VERSION };
        store.put(next).onsuccess = () => accept(next);
      };
    });
  })().finally(() => posterRepairs.delete(record.id));
  posterRepairs.set(record.id, repair);
  return repair;
}
