// Run in the desktop dev console after selecting a video wallpaper. Uses the
// application's StrictMode lifecycle in an invisible fixture; leaves user state alone.
import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import WallpaperMedia from '/src/personalized-home-2-0/themes/WallpaperMedia.jsx';

export async function checkVideoPlayback() {
  const active = document.querySelector('video[data-wallpaper-id]');
  const src = active?.getAttribute('src');
  if (!src) throw new Error('请先选用一个视频壁纸');
  const frame = document.createElement('iframe');
  frame.inert = true;
  frame.style.cssText = 'position:fixed;inset:0;width:800px;height:500px;opacity:0;pointer-events:none';
  const loaded = new Promise(resolve => { frame.onload = resolve; });
  frame.srcdoc = '<!doctype html><body style="margin:0"><div id="mount" style="position:relative;width:640px;height:360px"></div></body>';
  document.body.append(frame);
  await loaded;
  const root = createRoot(frame.contentDocument.getElementById('mount'));
  let unmounted = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    flushSync(() => root.render(createElement(StrictMode, null, createElement(WallpaperMedia, {
      src, mimeType:'video/mp4', posterUrl:active.getAttribute('poster'),
    }))));
    const video = frame.contentDocument.querySelector('video');
    if (video.getAttribute('src') !== src) throw new Error('严格模式重放后视频地址丢失');
    const began = performance.now();
    while (video.readyState < 2 || video.paused) {
      if (performance.now() - began > 10000) throw new Error('视频未自动播放');
      await wait(30);
    }
    const before = video.currentTime;
    const beforeFrames = video.getVideoPlaybackQuality?.().totalVideoFrames || 0;
    await wait(600);
    const frames = video.getVideoPlaybackQuality?.().totalVideoFrames || 0;
    if (Math.abs(video.currentTime - before) < .005 && frames <= beforeFrames) throw new Error('视频画面未推进');
    if (!video.muted || !video.defaultMuted || video.volume !== 0 || !video.loop) throw new Error('视频播放策略改变');
    const result = { strictMode:true, readyState:video.readyState, muted:video.muted, loop:video.loop, frames, time:video.currentTime };
    flushSync(() => root.unmount());
    unmounted = true;
    if (!video.paused || video.hasAttribute('src')) throw new Error('卸载未释放播放器');
    return { ...result, cleanup:true };
  } finally {
    if (!unmounted) flushSync(() => root.unmount());
    frame.remove();
  }
}
