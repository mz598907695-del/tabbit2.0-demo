import { useLayoutEffect, useRef } from 'react';
import WallpaperImage from './WallpaperImage';
import { isVideoWallpaper } from './wallpaper-video.js';
import { registerWallpaperVideo } from './wallpaperVideoPlayback.js';
import { prepareWallpaperVideoPresentation } from './wallpaperVideoPresentation.js';

function WallpaperVideo({ src, posterUrl, style, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const video = ref.current;
    // StrictMode and Fast Refresh replay setup after cleanup on the same DOM
    // node. Cleanup releases the decoder, so setup must restore its source.
    if (video.getAttribute('src') !== src) {
      video.src = src;
      video.load();
    }
    const releasePresentation = prepareWallpaperVideoPresentation(video, { posterUrl });
    const detach = registerWallpaperVideo(video, src);
    return () => {
      releasePresentation();
      detach();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);
  return <video {...props} ref={ref} src={src} autoPlay muted loop playsInline
    controls={false} disablePictureInPicture disableRemotePlayback preload="auto" tabIndex={-1} aria-hidden="true"
    style={{ ...style, opacity:0, position:'absolute', inset:0, display:'block', margin:0, width:'100%', height:'100%', maxWidth:'none', maxHeight:'none', objectFit:'cover', objectPosition:'center bottom', pointerEvents:'none' }}/>
}

/** Static gallery covers never start a decoder. Existing image rendering keeps
 * its alpha-padding crop; videos use native cover for all moving frames. */
export default function WallpaperMedia({ src, mimeType, posterUrl, preview = false, alt = '', loading, decoding, ...props }) {
  if (!src) return null;
  if (isVideoWallpaper({ mimeType, url:src })) {
    if (preview) return posterUrl ? <WallpaperImage {...props} src={posterUrl} alt={alt} mimeType="image/jpeg" loading={loading} decoding={decoding}/> : null;
    return <WallpaperVideo key={src} {...props} src={src} posterUrl={posterUrl}/>;
  }
  return <WallpaperImage {...props} src={src} alt={alt} mimeType={mimeType} loading={loading} decoding={decoding}/>;
}
