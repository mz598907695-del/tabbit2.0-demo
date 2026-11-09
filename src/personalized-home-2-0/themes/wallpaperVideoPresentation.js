const presentations = new WeakMap();

export function getWallpaperVideoPresentation(video) {
  return presentations.get(video) || null;
}

/** A gallery poster may be seconds ahead of the opening frame. Moving
 * backgrounds stay transparent until an actual video frame can take over. */
export function prepareWallpaperVideoPresentation(video, { posterUrl, revealDuration } = {}) {
  const win = video.ownerDocument.defaultView;
  const duration = revealDuration ?? (win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
  let disposed = false, presented = false, settled = false;
  let frame = null, paint = 0, fallback = 0, reveal = 0;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Initial app loads have no handoff waiter; disposal must still be handled.
  void ready.catch(() => {});
  presentations.set(video, ready);
  video.removeAttribute('poster');
  video.style.opacity = '0';
  video.style.transition = `opacity ${duration}ms linear`;
  video.dataset.wallpaperVideoState = 'loading';

  function cancelFrame() {
    if (frame !== null) video.cancelVideoFrameCallback?.(frame);
    frame = null;
    if (paint) win?.cancelAnimationFrame?.(paint);
    paint = 0;
    clearTimeout(fallback); fallback = 0;
  }
  function showFrame() {
    if (disposed || settled || presented || video.seeking || video.readyState < 2) return;
    presented = true;
    cancelFrame();
    video.dataset.wallpaperVideoState = 'presented';
    video.style.opacity = '1';
    reveal = setTimeout(() => {
      if (disposed || settled) return;
      settled = true; clearTimeout(timeout);
      video.dataset.wallpaperVideoState = 'ready';
      resolveReady();
    }, duration);
  }
  function requestFrame() {
    if (disposed || presented || settled || frame !== null || !video.requestVideoFrameCallback) return;
    frame = video.requestVideoFrameCallback(() => {
      frame = null;
      if (video.seeking || video.readyState < 2) requestFrame();
      else showFrame();
    });
  }
  function playing() {
    requestFrame();
    // Some WebKit versions suppress callbacks while the incoming parent has
    // zero opacity. A playing, decoded frame after paint also breaks that cycle.
    clearTimeout(fallback);
    fallback = setTimeout(() => {
      if (disposed || presented || settled || video.paused || video.seeking || video.readyState < 2) return;
      if (win?.requestAnimationFrame) paint = win.requestAnimationFrame(() => {
        paint = win.requestAnimationFrame(() => { paint = 0; showFrame(); });
      });
      else showFrame();
    }, video.requestVideoFrameCallback ? 120 : 0);
  }
  function failed() {
    if (disposed || settled) return;
    settled = true;
    cancelFrame(); clearTimeout(reveal); clearTimeout(timeout);
    video.dataset.wallpaperVideoState = 'error';
    // Covers remain available as a static fallback only after a media failure.
    if (posterUrl) { video.poster = posterUrl; video.style.opacity = '1'; }
    rejectReady(new Error('Video wallpaper presentation unavailable'));
  }
  const timeout = setTimeout(failed, 10000);
  video.addEventListener('playing', playing);
  video.addEventListener('seeked', requestFrame);
  video.addEventListener('error', failed);
  requestFrame();
  if (!video.paused && video.readyState >= 2) playing();

  return () => {
    disposed = true;
    cancelFrame(); clearTimeout(reveal); clearTimeout(timeout);
    video.removeEventListener('playing', playing);
    video.removeEventListener('seeked', requestFrame);
    video.removeEventListener('error', failed);
    if (presentations.get(video) === ready) presentations.delete(video);
    if (!settled) rejectReady(new Error('Video wallpaper presentation cancelled'));
  };
}
