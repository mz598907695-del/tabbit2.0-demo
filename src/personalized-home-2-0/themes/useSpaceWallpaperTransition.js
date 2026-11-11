import { isVideoWallpaper, waitForWallpaperMedia } from './wallpaper-video.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SPACE_GESTURE_EVENT } from '../../spaceTransition';
import { WINDOW_WALLPAPER_EVENT } from '../../windowWallpaper';
import { getExampleWallpaper } from './exampleWallpapers';
import { getThemeBackground } from './appearance';
import { useWallpaperSelectionTransition } from './useWallpaperSelectionTransition';

// These themes color the native glass; their page stays translucent. A solid
// theme color here would cover that glass and whiten the page during a swipe.
const glassBackgroundThemes = new Set(['light', 'dark', 'cream', 'mint']);

// Keep pointer-rate progress out of React: the window and new-tab planes share
// one inherited CSS value, while scene changes render only once per gesture.
export function useSpaceWallpaperTransition(theme, wallpaper, wallpapers, appearance, blurred, spaceId) {
  const [transition, setTransition] = useState(null);
  const latest = useRef(null);
  latest.current = { theme, wallpaper, wallpapers, appearance, blurred };
  const active = useRef(null);
  const progress = useRef(0);
  const frame = useRef(0);
  const selectionTransition = useWallpaperSelectionTransition({ id:theme, url:wallpaper?.url || '',
    mimeType:wallpaper?.mimeType, posterUrl:wallpaper?.posterUrl, blurred,
    color:glassBackgroundThemes.has(theme) ? 'transparent' : getThemeBackground(theme, appearance), appearance }, spaceId, transition);
  const backgroundTransition = transition || selectionTransition;

  useEffect(() => {
    const root = document.documentElement;
    const apply = value => {
      progress.current = value;
      root.style.setProperty('--space-wallpaper-progress', String(value));
    };
    const reset = () => {
      active.current = null;
      setTransition(null);
      apply(0);
    };
    const animate = (target, duration, complete) => {
      cancelAnimationFrame(frame.current);
      const start = progress.current;
      const began = performance.now();
      const tick = now => {
        const fraction = Math.min(1, (now - began) / duration);
        apply(start + (target - start) * (1 - (1 - fraction) ** 3));
        if (fraction < 1) frame.current = requestAnimationFrame(tick);
        else complete?.();
      };
      frame.current = requestAnimationFrame(tick);
    };
    const sync = event => {
      const detail = event.detail;
      if (!detail) {
        if (active.current && !active.current.committing) animate(0, 240, reset);
        return;
      }
      const current = latest.current;
      const destinationTheme = localStorage.getItem(`tabbit-glass-theme:${detail.toSpaceId}`) || 'light';
      if (!active.current || active.current.toSpaceId !== detail.toSpaceId) {
        const nextWallpaper = getExampleWallpaper(destinationTheme)
          || current.wallpapers.find(item => item.id === destinationTheme);
        // Color-only gestures already have their native glass transition.
        if (!current.wallpaper && !nextWallpaper) return;
        const scene = (id, image) => ({ id, url:image?.url || '', mimeType:image?.mimeType, posterUrl:image?.posterUrl,
          color:glassBackgroundThemes.has(id) ? 'transparent' : getThemeBackground(id, current.appearance), blurred:current.blurred });
        const next = { from:scene(current.theme, current.wallpaper), to:scene(destinationTheme, nextWallpaper) };
        active.current = { ...next, fromSpaceId:detail.fromSpaceId, toSpaceId:detail.toSpaceId, committing:false };
        setTransition(next);
      }
      cancelAnimationFrame(frame.current);
      const value = Math.max(0, Math.min(1, detail.progress));
      if (detail.duration) {
        active.current.committing = true;
        animate(value, detail.duration);
      } else {
        active.current.committing = false;
        apply(value);
      }
    };
    window.addEventListener(SPACE_GESTURE_EVENT, sync);
    return () => {
      window.removeEventListener(SPACE_GESTURE_EVENT, sync);
      cancelAnimationFrame(frame.current);
      root.style.removeProperty('--space-wallpaper-progress');
    };
  }, []);

  // Hand off only when the new space's real background has been mounted.
  useLayoutEffect(() => {
    const handoff = active.current;
    if (!handoff?.committing || handoff.to.id !== theme || handoff.toSpaceId !== spaceId) return;
    let cancelled = false;
    const finish = () => {
      if (cancelled || active.current !== handoff) return;
      cancelAnimationFrame(frame.current);
      progress.current = 1;
      document.documentElement.style.setProperty('--space-wallpaper-progress', '1');
      active.current = null;
      setTransition(null);
    };
    if (handoff.to.url) {
      // Retain the already-painted source until every destination surface has
      // decoded. The keyed destination nodes survive the handoff unchanged.
      const media = [...document.querySelectorAll(`[data-wallpaper-id="${CSS.escape(handoff.to.id)}"]`)];
      Promise.allSettled(media.map(waitForWallpaperMedia)).then(finish);
    } else finish();
    return () => { cancelled = true; };
  }, [theme, wallpaper?.url, spaceId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(WINDOW_WALLPAPER_EVENT, {
      detail:{ wallpaper:wallpaper ? { ...wallpaper, blurred } : null, transition:backgroundTransition },
    }));
  }, [wallpaper, blurred, backgroundTransition]);

  useEffect(() => {
    // Warm saved space images before the first swipe, including local uploads.
    const urls = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('tabbit-glass-theme:')) continue;
      const id = localStorage.getItem(key);
      const item = getExampleWallpaper(id) || wallpapers.find(image => image.id === id);
      if (item) urls.add(isVideoWallpaper(item) ? item.posterUrl : item.url);
    }
    for (const url of urls) { if (!url) continue; const image = new Image(); image.src = url; }
    // Let in-flight loads finish when the active theme changes; aborting them
    // here can evict the very image the committed space is about to display.
  }, [wallpapers]);

  return backgroundTransition;
}
