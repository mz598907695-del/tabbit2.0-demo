import ThemeBackground from './themes/ThemeBackground';
import MonochromeThemeBackground from './themes/MonochromeThemeBackground';
import ScrollThemeBackground from './themes/ScrollThemeBackground';
import { getScrollTheme } from './themes/scroll-themes';
import { getMonochromeTheme } from './themes/monochrome-themes';
import OceanFishingTheme from './themes/ocean/OceanFishingTheme';
import WallpaperImage from './themes/WallpaperImage';

// Fragments preserve the background renderers' direct-child layout and stacking.
export default function HomeBackground({ theme, illustratedTheme, active, paused, wallpaper, ocean }) {
  return <>
    <ThemeBackground theme={illustratedTheme} active={active}/>
    {ocean && <OceanFishingTheme {...ocean} blocked={paused}/>}
    {wallpaper && <div className="uploaded-wallpaper-background" aria-hidden="true">
      <WallpaperImage src={wallpaper.url} mimeType={wallpaper.mimeType}/>
    </div>}
    <MonochromeThemeBackground theme={getMonochromeTheme(theme)} active={active && !paused}/>
    <ScrollThemeBackground theme={getScrollTheme(theme)} active={active && !paused}/>
  </>;
}
