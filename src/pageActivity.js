const subscriptions = new WeakMap();

/** A page is active only while it is visible and its native window has focus. */
export function isPageActive(doc = globalThis.document) {
  if (!doc || doc.hidden) return false;
  const subscription = subscriptions.get(doc);
  if (subscription) return subscription.focused;
  return typeof doc.hasFocus !== 'function' || doc.hasFocus();
}

function activitySubscription(doc) {
  let subscription = subscriptions.get(doc);
  if (subscription) return subscription;

  const callbacks = new Set();
  const view = doc.defaultView;
  let focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
  const notify = event => {
    if (event?.type === 'focus') focused = true;
    else if (event?.type === 'blur' || event?.type === 'pagehide') focused = false;
    else if (event?.type === 'pageshow') focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
    subscription.focused = focused;
    const active = !doc.hidden && focused;
    for (const callback of callbacks) callback(active);
  };
  doc.addEventListener('visibilitychange', notify);
  for (const event of ['focus', 'blur', 'pageshow', 'pagehide']) view?.addEventListener?.(event, notify);
  subscription = {
    callbacks,
    focused,
    dispose() {
      doc.removeEventListener('visibilitychange', notify);
      for (const event of ['focus', 'blur', 'pageshow', 'pagehide']) view?.removeEventListener?.(event, notify);
      subscriptions.delete(doc);
    },
  };
  subscriptions.set(doc, subscription);
  return subscription;
}

/** Shares one native-window/page listener set between all animation systems. */
export function subscribePageActivity(callback, doc = globalThis.document) {
  if (!doc) {
    callback(false);
    return () => {};
  }
  const subscription = activitySubscription(doc);
  subscription.callbacks.add(callback);
  callback(isPageActive(doc));
  return () => {
    subscription.callbacks.delete(callback);
    if (!subscription.callbacks.size) subscription.dispose();
  };
}

/** Exposes activity to CSS so compositor animations also stop off-window. */
export function reflectPageActivity(doc = globalThis.document) {
  const root = doc?.documentElement;
  if (!root) return () => {};
  return subscribePageActivity(active => {
    root.dataset.pageActive = active ? 'true' : 'false';
  }, doc);
}
