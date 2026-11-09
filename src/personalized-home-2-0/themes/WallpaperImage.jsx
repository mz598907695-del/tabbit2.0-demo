import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { findWallpaperAlphaBounds, getWallpaperCoverRect, getWallpaperSampleSize, hasWallpaperAlphaPadding } from './wallpaperImageBounds.js';

function sampleAlphaBounds(image) {
  const sample = getWallpaperSampleSize(image.naturalWidth, image.naturalHeight);
  if (!sample) return null;
  const canvas = document.createElement('canvas');
  canvas.width = sample.width;
  canvas.height = sample.height;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, sample.width, sample.height);
    return findWallpaperAlphaBounds(context.getImageData(0, 0, sample.width, sample.height));
  } catch {
    // Cross-origin images and unavailable canvas reads keep ordinary cover.
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function MeasuredWallpaperImage({ src, alt, loading, mimeType, style, onLoad, onError, ...props }) {
  const imageRef = useRef(null);
  const boundsRef = useRef(null);
  const viewportRef = useRef(null);
  const [rect, setRect] = useState(null);

  const updateLayout = useCallback(() => {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    const next = image && viewport && hasWallpaperAlphaPadding(boundsRef.current)
      ? getWallpaperCoverRect(image.naturalWidth, image.naturalHeight, boundsRef.current, viewport.width, viewport.height)
      : null;
    setRect(current => current === next || (current && next
      && ['width', 'height', 'left', 'top'].every(key => current[key] === next[key])) ? current : next);
  }, []);

  const inspectImage = useCallback(image => {
    // A GIF's later frames can occupy different bounds. Its original img keeps
    // animating; known GIFs use native cover instead of cropping one frame.
    const isGif = mimeType?.toLowerCase().split(';')[0].trim() === 'image/gif'
      || /(?:\.gif(?:[?#]|$)|^data:image\/gif[;,])/i.test(src);
    boundsRef.current = isGif ? null : sampleAlphaBounds(image);
    updateLayout();
  }, [mimeType, src, updateLayout]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    const parent = image?.parentElement;
    if (!image || !parent) return;
    const measure = () => {
      const box = parent.getBoundingClientRect();
      viewportRef.current = { width: box.width, height: box.height };
      updateLayout();
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      viewportRef.current = { width: box.width, height: box.height };
      updateLayout();
    });
    observer?.observe(parent);
    if (!observer) window.addEventListener('resize', measure);
    if (image.complete && image.naturalWidth) inspectImage(image);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [inspectImage, updateLayout]);

  return <img {...props} ref={imageRef} src={src} alt={alt} loading={loading} draggable={false}
    style={{
      ...style,
      position: 'absolute', inset: 'auto', display: 'block', margin: 0,
      left: rect?.left ?? 0, top: rect?.top ?? 0,
      width: rect?.width ?? '100%', height: rect?.height ?? '100%',
      maxWidth: 'none', maxHeight: 'none',
      objectFit: rect ? 'fill' : 'cover', objectPosition: 'center bottom',
    }}
    onLoad={event => { inspectImage(event.currentTarget); onLoad?.(event); }}
    onError={event => { boundsRef.current = null; setRect(null); onError?.(event); }}
  />;
}

/** Render inside an existing positioned, overflow-hidden viewport of any size. */
export default function WallpaperImage({ src, alt = '', ...props }) {
  if (!src) return null;
  return <MeasuredWallpaperImage key={src} {...props} src={src} alt={alt} />;
}
