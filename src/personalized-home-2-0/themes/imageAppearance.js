import { isVideoWallpaper, decodeWallpaperVideo } from './wallpaper-video.js';
import { classifyThemePixels } from './image-luminance.js';
export { classifyThemePixels } from './image-luminance.js';
import { getBundledWallpaper } from './officialWallpapers';
import { getThemeAppearance } from './appearance';

const analyzedImages = new Map();

function analyzeImage(url, fallback) {
  if (analyzedImages.has(url)) return analyzedImages.get(url);
  const result = new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = (mode, analyzed = true) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      // A load/decode failure is temporary, not a measured light image.
      if (!analyzed) analyzedImages.delete(url);
      resolve(mode);
    };
    const timeout = setTimeout(() => finish(fallback, false), 10000);
    image.onload = async () => {
      let canvas;
      try {
        await image.decode();
        if (settled) return;
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d', { willReadFrequently:true });
        context.drawImage(image, 0, 0, 64, 64);
        finish(classifyThemePixels(context.getImageData(0, 0, 64, 64).data));
      } catch { finish(fallback, false); }
      finally { if (canvas) canvas.width = canvas.height = 0; }
    };
    image.onerror = () => finish(fallback, false);
    image.src = url;
  });
  analyzedImages.set(url, result);
  return result;
}

/** Analyze on-device only; artwork never leaves the browser. */
export function getAutomaticThemeAppearance(theme, wallpapers = []) {
  const wallpaper = getBundledWallpaper(theme) || wallpapers.find(item => item.id === theme);
  // Bundled wallpapers have authored metadata. Personal uploads intentionally
  // omit it and continue through the on-device image/video analysis below.
  if (wallpaper?.appearance === 'light' || wallpaper?.appearance === 'dark') return Promise.resolve(wallpaper.appearance);
  const url = wallpaper?.posterUrl || wallpaper?.url;
  const fallback = getThemeAppearance(theme);
  if (wallpaper && isVideoWallpaper(wallpaper) && !wallpaper.posterUrl) {
    return decodeWallpaperVideo(wallpaper.url).then(async ({ poster }) => {
      const cover = URL.createObjectURL(poster);
      try { return await analyzeImage(cover, fallback); }
      finally { analyzedImages.delete(cover); URL.revokeObjectURL(cover); }
    }).catch(() => fallback);
  }
  return url ? analyzeImage(url, fallback) : Promise.resolve(fallback);
}
