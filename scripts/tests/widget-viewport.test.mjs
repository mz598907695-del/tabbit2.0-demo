import test from 'node:test';
import assert from 'node:assert/strict';
import { observeWidgetViewport } from '../../src/personalized-home-2-0/board/useWidgetActivity.js';

function fixture() {
  const instances = [];
  class Observer {
    targets = new Set();
    disconnected = false;
    constructor(callback, options) { this.callback = callback; this.options = options; instances.push(this); }
    observe(element) { this.targets.add(element); }
    unobserve(element) { this.targets.delete(element); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    emit(element, isIntersecting) { this.callback([{ target: element, isIntersecting }]); }
  }
  const doc = { defaultView: { IntersectionObserver: Observer, innerHeight: 1200, innerWidth: 1000 } };
  const listeners = new Map();
  const root = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name), getBoundingClientRect: () => ({ top: 100, bottom: 700, left: 200, right: 900 }) };
  const element = top => ({ ownerDocument: doc, closest: selector => selector === '.home-scroll' ? root : null, getBoundingClientRect: () => ({ top, bottom: top + 100, left: 250, right: 450 }) });
  return { instances, element, root, listeners };
}

test('widget prewarming uses the nested scrollport and fills its initial viewport synchronously', () => {
  const f = fixture(), visible = [], nearby = [], distant = [];
  const releases = [observeWidgetViewport(f.element(200), v => visible.push(v)), observeWidgetViewport(f.element(900), v => nearby.push(v)), observeWidgetViewport(f.element(1600), v => distant.push(v))];
  assert.deepEqual(visible, [{ visible: true, near: true }]);
  assert.deepEqual(nearby, [{ visible: false, near: true }]);
  assert.deepEqual(distant, [{ visible: false, near: false }]);
  assert.equal(f.instances.length, 2, 'the whole board shares two observers');
  assert.equal(f.instances[0].options.root, f.root);
  assert.equal(f.instances[1].options.rootMargin, '320px');
  releases.forEach(release => release());
});

test('visibility and prewarming update independently and release observers after the last card', () => {
  const f = fixture(), first = f.element(1600), second = f.element(1700), updates = [];
  const releaseFirst = observeWidgetViewport(first, value => updates.push(value));
  const releaseSecond = observeWidgetViewport(second, () => {});
  f.instances[1].emit(first, true);
  f.instances[0].emit(first, true);
  f.instances[0].emit(first, true);
  f.instances[0].emit(first, false);
  assert.deepEqual(updates, [{ visible: false, near: false }, { visible: false, near: true }, { visible: true, near: true }, { visible: false, near: true }]);
  releaseFirst();
  assert.ok(f.instances.every(observer => !observer.disconnected && !observer.targets.has(first)));
  f.instances[1].emit(first, false);
  assert.equal(updates.length, 4, 'late observer deliveries cannot update an unmounted card');
  releaseSecond();
  assert.ok(f.instances.every(observer => observer.disconnected));
  const releaseAgain = observeWidgetViewport(first, () => {});
  assert.equal(f.instances.length, 4, 'a future board gets clean observers');
  releaseAgain();
});

test('without IntersectionObserver, widget contents remain available', () => {
  const updates = [];
  const release = observeWidgetViewport({ ownerDocument: { defaultView: {} } }, value => updates.push(value));
  assert.deepEqual(updates, [{ visible: true, near: true }]);
  release();
});


test('incoming page widgets are ready before paint despite starting horizontally outside the scrollport', () => {
  const f = fixture(), target = f.element(200), updates = [];
  let moving = false;
  target.getBoundingClientRect = () => ({ top: 200, bottom: 300, left: 1600, right: 1800 });
  target.closest = selector => selector === '.home-scroll' ? f.root : moving ? {} : null;
  const release = observeWidgetViewport(target, value => updates.push(value));
  assert.deepEqual(updates.at(-1), { visible: false, near: false });
  moving = true;
  f.listeners.get('board-page-layout-ready')();
  assert.deepEqual(updates.at(-1), { visible: true, near: true });
  f.instances[1].emit(target, false);
  assert.deepEqual(updates.at(-1), { visible: true, near: true }, 'horizontal observer reports cannot unload incoming contents');
  release();
  assert.equal(f.listeners.size, 0);
});
