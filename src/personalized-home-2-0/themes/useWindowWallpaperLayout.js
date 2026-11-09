import { useLayoutEffect } from 'react';
import { WALLPAPER_LAYOUT_EVENT } from '../../windowWallpaper';

export function useWindowWallpaperLayout(homeRef) {
  useLayoutEffect(() => {
    const home = homeRef.current;
    if (!home) return;
    // The internal sidebar changes the home column, not the wallpaper canvas.
    // Anchor to the whole new-tab shell so its image remains still underneath
    // both the navigation and the moving content column.
    const anchor = home.closest('.aiw-shell') || home;
    const root = document.documentElement;
    let lastLayout = '';
    const sync = () => {
      const content = anchor.getBoundingClientRect();
      const viewport = root.getBoundingClientRect();
      // Hidden persistent pages retain the last visible composition.
      if (!content.width || !content.height) return;
      const centerX = content.left + content.width / 2 - viewport.left;
      // Keep horizontal centering on the content while anchoring the shared
      // wallpaper's bottom to the window for every clipped surface.
      const width = 2 * Math.max(centerX, viewport.width - centerX);
      const layout = `${centerX}:${width}:${viewport.height}`;
      if (layout === lastLayout) return;
      lastLayout = layout;
      root.style.setProperty('--wallpaper-canvas-left', `${centerX - width / 2}px`);
      root.style.setProperty('--wallpaper-canvas-top', '0px');
      root.style.setProperty('--wallpaper-canvas-width', `${width}px`);
      root.style.setProperty('--wallpaper-canvas-height', `${viewport.height}px`);
      window.dispatchEvent(new Event(WALLPAPER_LAYOUT_EVENT));
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(anchor);
    observer.observe(root);
    return () => {
      observer.disconnect();
      for (const property of ['left', 'top', 'width', 'height']) root.style.removeProperty(`--wallpaper-canvas-${property}`);
    };
  }, [homeRef]);
}
