const SLIDE_DURATION = 5000;

// Progress bars need animation frames. The inline carousel has no progress bar
// and sleeps until its next slide instead of waking the main thread every frame.
export function createPromotionClock({
  count, onIndexChange, onProgress,
  now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = id => clearTimeout(id),
}) {
  let index = 0, elapsed = 0, lastTime = null, scheduled = null;
  let started = false, disposed = false;
  const pauseReasons = new Set();
  const paint = () => onProgress?.(index, Math.min(1, elapsed / SLIDE_DURATION));
  const cancel = () => {
    if (scheduled !== null) (onProgress ? cancelFrame : clearTimer)(scheduled);
    scheduled = null;
  };
  const accountTime = () => {
    if (lastTime !== null) elapsed += Math.max(0, now() - lastTime);
    lastTime = null;
  };
  function schedule() {
    if (disposed || !started || pauseReasons.size || count < 1 || (!onProgress && count < 2) || scheduled !== null) return;
    lastTime = now();
    scheduled = onProgress ? requestFrame(tick) : setTimer(tick, Math.max(0, SLIDE_DURATION - elapsed));
  }
  function tick() {
    scheduled = null;
    if (disposed || !started || pauseReasons.size) return;
    accountTime();
    if (elapsed >= SLIDE_DURATION) {
      index = (index + Math.floor(elapsed / SLIDE_DURATION)) % count;
      elapsed %= SLIDE_DURATION;
      onIndexChange(index);
    }
    paint();
    schedule();
  }
  return {
    start() {
      if (disposed) return;
      started = true;
      paint();
      schedule();
    },
    setPaused(reason, value) {
      if (disposed) return;
      const wasPaused = pauseReasons.size > 0;
      if (value) pauseReasons.add(reason);
      else pauseReasons.delete(reason);
      if (!wasPaused && pauseReasons.size) { accountTime(); cancel(); paint(); }
      else if (wasPaused && !pauseReasons.size) schedule();
    },
    select(nextIndex) {
      if (disposed || nextIndex < 0 || nextIndex >= count) return;
      cancel();
      index = nextIndex;
      elapsed = 0;
      lastTime = null;
      onIndexChange(index);
      paint();
      schedule();
    },
    dispose() {
      disposed = true;
      started = false;
      cancel();
      lastTime = null;
      pauseReasons.clear();
    },
  };
}
