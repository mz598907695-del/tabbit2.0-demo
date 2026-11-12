import { subscribePageActivity } from '../../pageActivity.js';

export function createWidgetClock({ subscribeActivity = subscribePageActivity, schedule = setInterval, cancel = clearInterval, now = () => new Date() } = {}) {
  const groups = new Map();
  let active = false, release = null;
  const tick = group => { const date = now(); group.listeners.forEach(listener => listener(date)); };
  function sync(group) {
    if (group.timer !== null) cancel(group.timer);
    group.timer = null;
    if (active && group.listeners.size) {
      tick(group);
      group.timer = schedule(() => tick(group), group.interval);
    }
  }
  return (listener, interval = 1000) => {
    let group = groups.get(interval);
    if (!group) { group = { interval, timer: null, listeners: new Set() }; groups.set(interval, group); }
    group.listeners.add(listener);
    if (!release) release = subscribeActivity(value => {
      active = value;
      groups.forEach(sync);
    });
    else if (group.timer === null) sync(group);
    else listener(now());
    return () => {
      group.listeners.delete(listener);
      if (!group.listeners.size) {
        if (group.timer !== null) cancel(group.timer);
        groups.delete(interval);
      }
      if (!groups.size) { release?.(); release = null; }
    };
  };
}

export const subscribeWidgetClock = createWidgetClock();
