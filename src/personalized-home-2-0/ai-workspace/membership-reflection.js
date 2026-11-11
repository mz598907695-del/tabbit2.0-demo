import { isVideoWallpaper } from '../themes/wallpaper-video';

export function resolveMembershipReflection(media, wallpaper, theme = 'light') {
  if (media.type === 'wallpaper') {
    if (wallpaper?.url) return { type:isVideoWallpaper(wallpaper)?'video':'image', url:wallpaper.url, name:wallpaper.name || '当前壁纸' };
    if (wallpaper?.color) return { type:'image', name:wallpaper.name || '当前主题', url:`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="${wallpaper.color}"/></svg>`)}` };
    return {type:'studio'};
  }
  if (['auto','day','night'].includes(media.type)) return { type:'video', url:`/personalized-home-2-0/asset/reflections/${media.type==='auto' ? theme==='dark'?'night':'day' : media.type}.mp4` };
  return media;
}
