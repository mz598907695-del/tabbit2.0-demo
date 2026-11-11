import test from 'node:test';
import assert from 'node:assert/strict';
import { isPageActive, reflectPageActivity, subscribePageActivity } from '../../src/pageActivity.js';

function page() {
  const doc = new EventTarget();
  const view = new EventTarget();
  let focused = true;
  doc.hidden = false;
  doc.defaultView = view;
  doc.documentElement = { dataset:{} };
  doc.hasFocus = () => focused;
  return {
    doc,
    hidden(value) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); },
    focused(value) { focused = value; view.dispatchEvent(new Event(value ? 'focus' : 'blur')); },
  };
}

test('page activity combines document visibility and native-window focus', () => {
  const host = page(), values = [];
  const release = subscribePageActivity(active => values.push(active), host.doc);
  assert.equal(isPageActive(host.doc), true);
  host.focused(false);
  host.hidden(true);
  host.focused(true);
  host.hidden(false);
  assert.deepEqual(values, [true, false, false, false, true]);
  release();
  host.focused(false);
  assert.equal(values.length, 5);
});

test('page activity reflection exposes compositor pause state to CSS', () => {
  const host = page();
  const release = reflectPageActivity(host.doc);
  assert.equal(host.doc.documentElement.dataset.pageActive, 'true');
  host.focused(false);
  assert.equal(host.doc.documentElement.dataset.pageActive, 'false');
  release();
});
