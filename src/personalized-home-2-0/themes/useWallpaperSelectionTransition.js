import { useLayoutEffect, useState } from 'react';
import { waitForWallpaperMedia } from './wallpaper-video.js';

/** Keep the previous scene mounted while a manually selected wallpaper decodes.
 * Space gestures own the same layers/progress and take priority over this fade. */
export function useWallpaperSelectionTransition(scene, spaceId, gestureTransition) {
  const [selection, setSelection] = useState(() => ({ scene, spaceId, transition:null }));
  if (selection.scene.id !== scene.id || selection.scene.url !== scene.url || selection.spaceId !== spaceId) {
    const progress = Number(document.documentElement.style.getPropertyValue('--space-wallpaper-progress')) || 0;
    const from = selection.transition && progress < .5 ? selection.transition.from : selection.scene;
    const mediaChanged = from.id !== scene.id || from.url !== scene.url;
    setSelection({ scene, spaceId, transition:!gestureTransition && mediaChanged
      && (from.url || scene.url) ? { from, to:scene } : null });
  }

  useLayoutEffect(() => {
    const transition = selection.transition;
    if (!transition || gestureTransition) return;
    const root = document.documentElement;
    let cancelled = false;
    let frame = 0;
    const apply = value => root.style.setProperty('--space-wallpaper-progress', String(value));
    apply(0);
    // The window background receives the same scene through its event bridge.
    // Give every surface time to mount before checking the destination media.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        const media = [...document.querySelectorAll(`[data-wallpaper-id="${CSS.escape(transition.to.id)}"]`)];
        await Promise.allSettled(media.map(waitForWallpaperMedia));
        if (cancelled) return;
        const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;
        const began = performance.now();
        const tick = now => {
          if (cancelled) return;
          const fraction = duration ? Math.min(1, (now - began) / duration) : 1;
          apply(1 - (1 - fraction) ** 3);
          if (fraction < 1) frame = requestAnimationFrame(tick);
          else setSelection(current => current === selection ? { ...current, transition:null } : current);
        };
        frame = requestAnimationFrame(tick);
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [selection, gestureTransition]);

  return selection.transition;
}
