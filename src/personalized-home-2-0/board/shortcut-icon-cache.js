// Page changes remount shortcut artwork. Keep resource outcomes outside React so
// a cached image does not flash its letter placeholder on every return visit.
// The browser still owns the image bytes and normal HTTP cache validation.
export function createShortcutIconCache({ maxEntries = 512, retryAfterMs = 60_000, now = Date.now } = {}) {
  const resources = new Map();

  function remember(src, entry) {
    if (!src) return;
    resources.delete(src);
    resources.set(src, entry);
    while (resources.size > maxEntries) resources.delete(resources.keys().next().value);
  }

  function read(src) {
    const entry = resources.get(src);
    if (entry?.status === 'failed' && now() >= entry.retryAt) {
      resources.delete(src);
      return undefined;
    }
    if (entry) remember(src, entry);
    return entry;
  }

  return {
    resolve(candidates, startIndex = 0) {
      for (let index = startIndex; index < candidates.length; index += 1) {
        const entry = read(candidates[index]);
        if (entry?.status !== 'failed') return { index, loaded: entry?.status === 'loaded' };
      }
      return { index: candidates.length, loaded: false };
    },
    loaded(src) { remember(src, { status: 'loaded' }); },
    failed(src) { remember(src, { status: 'failed', retryAt: now() + retryAfterMs }); },
  };
}

export const shortcutIconCache = createShortcutIconCache();
