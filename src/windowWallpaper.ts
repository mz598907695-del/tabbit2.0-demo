export const WINDOW_WALLPAPER_EVENT = "tabbit-window-wallpaper";
export const WALLPAPER_LAYOUT_EVENT = "tabbit-wallpaper-layout";

export type WindowWallpaper = {
  id: string;
  url: string;
  mimeType?: string;
  posterUrl?: string;
  blurred?: boolean;
};

export type WallpaperScene = WindowWallpaper & { color?:string };
export type WallpaperTransition = { from:WallpaperScene; to:WallpaperScene };
export type WindowWallpaperState = { wallpaper:WindowWallpaper | null; transition:WallpaperTransition | null };

export function getWallpaperLayers(wallpaper:WindowWallpaper | null | undefined, transition:WallpaperTransition | null | undefined) {
  if (!transition) return wallpaper ? [{ scene:wallpaper as WallpaperScene, incoming:false, outgoing:false }] : [];
  if (transition.from.id === transition.to.id) return [{ scene:transition.to, incoming:false, outgoing:false }];
  return [
    { scene:transition.from, incoming:false, outgoing:!transition.to.url },
    { scene:transition.to, incoming:true, outgoing:false },
  ];
}
