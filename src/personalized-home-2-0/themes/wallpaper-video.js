import { getWallpaperVideoPresentation } from './wallpaperVideoPresentation.js';

export const VIDEO_WALLPAPER_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export function isVideoWallpaper({ mimeType = '', url = '' } = {}) {
  return mimeType.toLowerCase().startsWith('video/') || /(?:\.(?:mp4|mov|webm)(?:[?#]|$)|^data:video\/)/i.test(url);
}

export const VIDEO_POSTER_VERSION = 2;

export function getVideoPosterTime(duration, attempt = 0) {
  if (!Number.isFinite(duration) || duration <= 0) return .1;
  const index = Math.min(2, Math.max(0, attempt));
  return Math.min(index === 0 ? 1 : Infinity, duration * [.1, .35, .65][index], Math.max(0, duration - .01));
}

/** WebKit can expose loadeddata before a drawable hardware-decoded frame.
 * Seek, present a muted frame in the document, then capture. Skip black lead-ins
 * when possible; the temporary element/decoder always leaves with the result. */
export function decodeWallpaperVideo(source) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const ownURL = source instanceof Blob;
    const url = ownURL ? URL.createObjectURL(source) : source;
    let settled = false, capturing = false, waiting = false, attempt = 0, target = 0;
    let frame = null, fallback;
    const cancelFrame = () => {
      if (frame !== null) video.cancelVideoFrameCallback?.(frame);
      frame = null;
      clearTimeout(fallback);
      waiting = false;
    };
    const cleanup = () => {
      clearTimeout(timeout);
      cancelFrame();
      video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      if (ownURL) URL.revokeObjectURL(url);
    };
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve(result);
    };
    const timeout = setTimeout(() => finish(new Error('Video decoding timed out')), 15000);
    function capture() {
      cancelFrame();
      if (settled || capturing || video.seeking || video.readyState < 2) return;
      capturing = true;
      video.pause();
      const width = video.videoWidth, height = video.videoHeight;
      if (!width || !height) { finish(new Error('Invalid video dimensions')); return; }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 560 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      try {
        const context = canvas.getContext('2d', { willReadFrequently:true });
        if (!context) throw new Error('Video poster unavailable');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let blank = true;
        for (let i = 0; i < pixels.length; i += 16) {
          if (pixels[i] > 12 || pixels[i + 1] > 12 || pixels[i + 2] > 12) { blank = false; break; }
        }
        if (blank && attempt < 2 && video.duration > .1) {
          canvas.width = canvas.height = 0;
          capturing = false;
          attempt++;
          seek();
          return;
        }
        canvas.toBlob(poster => {
          canvas.width = canvas.height = 0;
          finish(poster ? null : new Error('Video poster unavailable'), { width, height, poster });
        }, 'image/jpeg', .85);
      } catch (error) {
        canvas.width = canvas.height = 0;
        finish(error);
      }
    }
    function present() {
      if (settled || capturing || waiting || video.seeking || video.readyState < 2) return;
      waiting = true;
      if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(() => { frame = null; capture(); });
      // Older engines lack frame callbacks; the decoded seek remains drawable.
      fallback = setTimeout(capture, 250);
      void video.play().catch(() => { /* A paused decoded frame can still be captured. */ });
    }
    function seek() {
      if (settled) return;
      cancelFrame();
      video.pause();
      target = getVideoPosterTime(video.duration, attempt);
      try {
        if (Math.abs(video.currentTime - target) < .005 && video.readyState >= 2) present();
        else video.currentTime = target;
      } catch (error) { finish(error); }
    }
    video.muted = video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'auto';
    video.inert = true;
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.001;pointer-events:none;z-index:2147483647';
    video.onloadedmetadata = seek;
    video.onseeked = present;
    video.onloadeddata = () => { if (Math.abs(video.currentTime - target) < .08) present(); };
    video.onerror = () => finish(new Error('Unsupported or invalid video'));
    document.body.append(video);
    video.src = url;
    video.load();
  });
}

/** Space handoff waits for an actual decoded destination frame. */
export function waitForWallpaperMedia(media) {
  if (media.tagName !== 'VIDEO') return media.decode();
  const presented = getWallpaperVideoPresentation(media);
  if (presented) return presented;
  if (media.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      media.removeEventListener('loadeddata', ready);
      media.removeEventListener('error', failed);
      if (error) reject(error); else resolve();
    };
    const ready = () => finish();
    const failed = () => finish(new Error('Video wallpaper unavailable'));
    const timer = setTimeout(failed, 10000);
    media.addEventListener('loadeddata', ready);
    media.addEventListener('error', failed);
  });
}
