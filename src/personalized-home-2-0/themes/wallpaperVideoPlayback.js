// Each window has a clock per URL: browser chrome and the shared new-tab
// background (home + sidebar) show the same moment. Native video decoding/looping owns playback; no RAF loop.
import { isPageActive, subscribePageActivity } from '../../pageActivity.js';

const documents = new WeakMap();
const MAX_DRIFT = .08;

export function registerWallpaperVideo(video, src) {
  const doc = video.ownerDocument;
  let state = documents.get(doc);
  if (!state) {
    state = { groups:new Map(), active:isPageActive(doc), releaseActivity:null };
    state.releaseActivity = subscribePageActivity(active => {
      state.active = active;
      for (const group of state.groups.values()) for (const entry of group.entries) entry.update();
    }, doc);
    documents.set(doc, state);
  }
  let group = state.groups.get(src);
  if (!group) {
    group = { entries:new Set(), time:0 };
    state.groups.set(src, group);
  }
  const entry = { video, visible:false, update };
  const eligible = item => item.visible && state.active && item.video.isConnected;
  const leader = () => {
    const playing = item => item && group.entries.has(item) && eligible(item) && !item.video.paused && item.video.readyState >= 2;
    if (!playing(group.primary)) group.primary = [...group.entries].find(playing);
    return group.primary;
  };
  const mute = () => { video.muted = video.defaultMuted = true; video.volume = 0; };
  const align = (time, joining = false) => {
    if (!video.readyState || !Number.isFinite(time)) return;
    const duration = video.duration;
    const target = Number.isFinite(duration) && duration > 0 ? time % duration : time;
    const difference = Math.abs(video.currentTime - target);
    const drift = Number.isFinite(duration) && duration > 0 ? Math.min(difference, Math.abs(duration - difference)) : difference;
    if (drift > (joining ? .02 : MAX_DRIFT)) {
      try { video.currentTime = target; } catch { /* A later loadeddata retries. */ }
    }
  };
  function update() {
    mute();
    if (!eligible(entry)) {
      if (!video.paused && video.readyState >= 2) group.time = video.currentTime;
      video.pause();
      return;
    }
    const peer = leader();
    if (peer !== entry) align(peer?.video.currentTime ?? group.time);
    if (video.paused && video.readyState >= 2) void video.play().catch(() => { /* Keep the poster until playback can resume. */ });
  }
  const started = () => {
    update();
    if (!eligible(entry)) return;
    const peer = leader();
    if (peer && peer !== entry) align(peer.video.currentTime, true);
  };
  const timeupdate = () => {
    if (leader() !== entry) return;
    group.time = video.currentTime;
    for (const peer of group.entries) if (peer !== entry && eligible(peer) && peer.video.readyState >= 2) peer.align(group.time);
  };
  entry.align = align;
  group.entries.add(entry);
  mute();
  for (const event of ['loadedmetadata', 'loadeddata', 'canplay']) video.addEventListener(event, update);
  video.addEventListener('play', started);
  video.addEventListener('timeupdate', timeupdate);
  const Observer = doc.defaultView?.IntersectionObserver;
  const observer = Observer ? new Observer(([intersection]) => { entry.visible = intersection.isIntersecting; update(); }) : null;
  if (observer) observer.observe(video);
  else entry.visible = true;
  update();
  return () => {
    if (leader() === entry) group.time = video.currentTime;
    group.entries.delete(entry);
    observer?.disconnect();
    for (const event of ['loadedmetadata', 'loadeddata', 'canplay']) video.removeEventListener(event, update);
    video.removeEventListener('play', started);
    video.removeEventListener('timeupdate', timeupdate);
    video.pause();
    if (!group.entries.size) {
      state.groups.delete(src);
      if (!state.groups.size) {
        state.releaseActivity();
        documents.delete(doc);
      }
    }
  };
}
