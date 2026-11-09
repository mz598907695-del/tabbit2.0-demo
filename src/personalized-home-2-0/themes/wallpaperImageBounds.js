export const WALLPAPER_ALPHA_SAMPLE_LIMIT = 512;
const MIN_VISIBLE_ALPHA = 8;

export function getWallpaperSampleSize(width, height) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(1, WALLPAPER_ALPHA_SAMPLE_LIMIT / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Normalized bounds, with exclusive edges; ignore almost invisible shadow padding. */
export function findWallpaperAlphaBounds({ data, width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || !data || data.length < width * height * 4) return null;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < MIN_VISIBLE_ALPHA) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) return null;
  return { left: left / width, top: top / height, right: right / width, bottom: bottom / height };
}

export function hasWallpaperAlphaPadding(bounds) {
  return Boolean(bounds && (bounds.left > 0 || bounds.top > 0 || bounds.right < 1 || bounds.bottom < 1));
}

/** Cover the viewport with visible image bounds, centered horizontally and bottom-aligned. */
export function getWallpaperCoverRect(imageWidth, imageHeight, bounds, viewportWidth, viewportHeight) {
  if (![imageWidth, imageHeight, viewportWidth, viewportHeight].every(value => Number.isFinite(value) && value > 0)
    || !bounds || ![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
    || bounds.left < 0 || bounds.top < 0 || bounds.right > 1 || bounds.bottom > 1
    || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return null;
  const contentWidth = imageWidth * (bounds.right - bounds.left);
  const contentHeight = imageHeight * (bounds.bottom - bounds.top);
  const scale = Math.max(viewportWidth / contentWidth, viewportHeight / contentHeight);
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
    left: (viewportWidth - contentWidth * scale) / 2 - bounds.left * imageWidth * scale,
    top: viewportHeight - bounds.bottom * imageHeight * scale,
  };
}
