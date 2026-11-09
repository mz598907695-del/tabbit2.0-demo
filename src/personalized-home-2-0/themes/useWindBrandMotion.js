import { useEffect } from 'react';
import { WIND_BRAND_KEYFRAMES } from './wind-brand-motion.js';

export function useWindBrandMotion(ref, wallpaper) {
  const id = wallpaper?.brandMotion === 'wind' ? wallpaper.id : null;
  const src = id ? wallpaper.url : null;

  useEffect(() => {
    const mark = ref.current;
    if (!id || !mark) return;
    const doc = mark.ownerDocument;
    const shell = mark.closest('.aiw-shell');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let video = null, animation = null, detach = null, stalled = false;
    let visible = !window.IntersectionObserver;
    let duration = 10080;

    function sync(force = false) {
      if (!video || !animation) return;
      if (reduced.matches) { animation.cancel(); return; }
      const nextDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : 10080;
      if (nextDuration !== duration) {
        duration = nextDuration;
        animation.effect.updateTiming({ duration });
        force = true;
      }
      const clock = video.currentTime * 1000;
      const local = Number(animation.currentTime || 0) % duration;
      const difference = Math.abs(local - clock);
      if (force || animation.playState === 'idle' || Math.min(difference, Math.abs(duration - difference)) > 80) animation.currentTime = clock;
      animation.playbackRate = video.playbackRate;
      const playing = visible && !doc.hidden && !video.paused && !video.ended && !stalled;
      if (playing && animation.playState !== 'running') animation.play();
      else if (!playing && animation.playState !== 'paused') animation.pause();
    }

    function connect(next) {
      if (next === video) return;
      detach?.(); animation?.cancel();
      video = next;
      stalled = video.readyState < 2;
      animation = mark.animate(WIND_BRAND_KEYFRAMES, { duration, iterations:Infinity, easing:'linear' });
      const update = event => {
        if (event.type === 'waiting' || event.type === 'emptied') stalled = true;
        if (['playing', 'canplay', 'loadeddata'].includes(event.type)) stalled = false;
        sync(['play', 'playing', 'seeked', 'loadedmetadata'].includes(event.type));
      };
      const events = ['play', 'playing', 'pause', 'timeupdate', 'seeking', 'seeked', 'ratechange', 'loadedmetadata', 'loadeddata', 'canplay', 'waiting', 'emptied'];
      events.forEach(event => video.addEventListener(event, update));
      const attached = video;
      detach = () => events.forEach(event => attached.removeEventListener(event, update));
      sync(true);
    }

    function matches(element) {
      return element instanceof HTMLVideoElement && element.dataset.wallpaperId === id
        && shell?.contains(element) && element.src === new URL(src, doc.baseURI).href;
    }
    // A scene may enter after the logo, or remount when returning from a conversation.
    const loaded = event => { if (matches(event.target)) connect(event.target); };
    doc.addEventListener('loadedmetadata', loaded, true);
    const existing = [...(shell?.querySelectorAll('video[data-wallpaper-id]') || [])].find(matches);
    if (existing) connect(existing);
    const visibility = () => sync(true);
    doc.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', visibility);
    const observer = window.IntersectionObserver ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting; sync(true);
    }) : null;
    observer?.observe(mark);

    return () => {
      detach?.(); animation?.cancel(); observer?.disconnect();
      doc.removeEventListener('loadedmetadata', loaded, true);
      doc.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', visibility);
    };
  }, [id, src, ref]);
}
