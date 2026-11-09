import { useLayoutEffect, useRef } from 'react';
import ThemeBackground from './themes/ThemeBackground';
import MonochromeThemeBackground from './themes/MonochromeThemeBackground';
import ScrollThemeBackground from './themes/ScrollThemeBackground';
import { getScrollTheme } from './themes/scroll-themes';
import { getMonochromeTheme } from './themes/monochrome-themes';
import OceanFishingTheme from './themes/ocean/OceanFishingTheme';
import WallpaperMedia from './themes/WallpaperMedia';
import { WALLPAPER_LAYOUT_EVENT, getWallpaperLayers } from '../windowWallpaper';

// Fragments preserve the background renderers' direct-child layout and stacking.
export function WindowAlignedWallpaper({ wallpaper, blurred = false }) {
  const clipRef = useRef(null);
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    const clip = clipRef.current;
    const canvas = canvasRef.current;
    if (!clip || !canvas) return;
    const overscan = blurred ? 24 : 0;
    let lastLayout = '';
    const sync = () => {
      const clipRect = clip.getBoundingClientRect();
      const rootRect = document.documentElement.getBoundingClientRect();
      const layout = getComputedStyle(document.documentElement);
      const left = parseFloat(layout.getPropertyValue('--wallpaper-canvas-left')) || 0;
      const top = parseFloat(layout.getPropertyValue('--wallpaper-canvas-top')) || 0;
      const width = parseFloat(layout.getPropertyValue('--wallpaper-canvas-width')) || rootRect.width;
      const height = parseFloat(layout.getPropertyValue('--wallpaper-canvas-height')) || rootRect.height;
      const nextLayout = `${clipRect.left}:${clipRect.top}:${rootRect.left}:${rootRect.top}:${left}:${top}:${width}:${height}`;
      if (nextLayout === lastLayout) return;
      lastLayout = nextLayout;
      canvas.style.left = `${rootRect.left + left - clipRect.left - overscan}px`;
      canvas.style.top = `${rootRect.top + top - clipRect.top - overscan}px`;
      canvas.style.width = `${width + overscan * 2}px`;
      canvas.style.height = `${height + overscan * 2}px`;
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(clip);
    observer.observe(document.documentElement);
    window.addEventListener('resize', sync);
    window.addEventListener(WALLPAPER_LAYOUT_EVENT, sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener(WALLPAPER_LAYOUT_EVENT, sync);
    };
  }, [blurred]);

  return <div ref={clipRef} className="uploaded-wallpaper-background" aria-hidden="true">
    <div ref={canvasRef} className={`window-aligned-wallpaper-canvas${blurred ? ' is-blurred' : ''}`}>
      <WallpaperMedia src={wallpaper.url} mimeType={wallpaper.mimeType} posterUrl={wallpaper.posterUrl} data-wallpaper-id={wallpaper.id}/>
    </div>
  </div>;
}

export function WallpaperTransitionBackground({ transition, wallpaper, blurred = false }) {
  const layers = getWallpaperLayers(wallpaper, transition);
  if (!layers.length) return null;
  return <div className={`wallpaper-background-layers${transition ? ' space-wallpaper-transition' : ''}`} aria-hidden="true">
    {layers.map(({scene, incoming, outgoing}) => <div key={scene.id} className={`space-wallpaper-scene${incoming ? ' is-incoming' : ''}${outgoing ? ' is-outgoing' : ''}`} data-theme-id={scene.id} style={{ backgroundColor:scene.url ? 'transparent' : scene.color }}>
      {scene.url && <WindowAlignedWallpaper wallpaper={scene} blurred={scene.blurred ?? blurred}/>}
    </div>)}
  </div>;
}

// Uploaded/official media belongs to AIWorkspace's shared background behind
// both the home and internal navigation. Only legacy scene renderers live here.
export default function HomeBackground({ theme, illustratedTheme, active, paused, ocean }) {
  return <>
    <ThemeBackground theme={illustratedTheme} active={active}/>
    {ocean && <OceanFishingTheme {...ocean} blocked={paused}/>}
    <MonochromeThemeBackground theme={getMonochromeTheme(theme)} active={active && !paused}/>
    <ScrollThemeBackground theme={getScrollTheme(theme)} active={active && !paused}/>
  </>;
}
