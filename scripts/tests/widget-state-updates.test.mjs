import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBoardPageChange, patchBoardWidgetConfig } from '../../src/personalized-home-2-0/board/board-page-updates.js';
import { completeTimer, startTimer, timerState } from '../../src/personalized-home-2-0/board/task-widget-data.js';
import { normalizeJokeConfig, normalizePhotoConfig } from '../../src/personalized-home-2-0/board/leisure-widget-data.js';

const widget = (id, config = {}) => ({ id, type: 'widget', config });
const page = items => ({ id: 'home-a', name: 'A', items, layouts: { saved: { x: 1 } } });

test('simultaneously completed timers merge into the latest page without dropping either update', () => {
  const initial = { minutes: 1, remaining: 60, endAt: 0 };
  const running = { ...initial, ...startTimer(initial, 1000) };
  let pages = [page([widget('timer-a', running), widget('timer-b', running)])];
  // Both effects captured the same page and deadline before either state write.
  const updates = ['timer-a', 'timer-b'].map(id => current => patchBoardWidgetConfig(current, id, completeTimer(running, 70000)));
  for (const update of updates) pages = applyBoardPageChange(pages, update, 'home-a');
  for (const item of pages[0].items) {
    assert.equal(item.config.phase, 'break');
    assert.equal(item.config.remaining, 300);
    assert.equal(item.config.completedSessions, 1);
    assert.equal(completeTimer(item.config, 80000), null);
  }
});

test('a deferred photo write preserves later locale, text, layout and page edits', () => {
  let pages = [page([widget('photo', { caption: 'before' }), widget('note', { text: 'before' })])];
  const deferredUpload = current => patchBoardWidgetConfig(current, 'photo', { photo: 'data:image/jpeg;base64,YQ==' });
  pages = applyBoardPageChange(pages, current => patchBoardWidgetConfig(current, 'photo', { locale: 'en-US' }), 'home-a');
  pages = applyBoardPageChange(pages, current => patchBoardWidgetConfig(current, 'note', { text: 'typed while uploading' }), 'home-a');
  const renamed = { ...pages[0], name: 'Renamed', layouts: { moved: { x: 2 } } };
  pages = applyBoardPageChange(pages, renamed); // Existing object call sites remain supported.
  pages = applyBoardPageChange(pages, deferredUpload, 'home-a');
  assert.equal(pages[0].name, 'Renamed');
  assert.deepEqual(pages[0].layouts, { moved: { x: 2 } });
  assert.equal(pages[0].items[0].config.locale, 'en-US');
  assert.equal(pages[0].items[0].config.photo, 'data:image/jpeg;base64,YQ==');
  assert.equal(pages[0].items[1].config.text, 'typed while uploading');
});

test('deferred changes do not recreate a deleted card or page', () => {
  const pages = [page([widget('kept', { text: 'safe' })])];
  assert.equal(applyBoardPageChange(pages, current => patchBoardWidgetConfig(current, 'deleted', { text: 'late' }), 'home-a'), pages);
  assert.equal(applyBoardPageChange(pages, current => patchBoardWidgetConfig(current, 'kept', { text: 'safe' }), 'home-a'), pages);
  assert.equal(applyBoardPageChange(pages, current => ({ ...current, name: 'late' }), 'deleted-page'), pages);
});

test('a persisted inactive timer catches up on return and waits at the next phase', () => {
  const config = { minutes: 1, remaining: 60, endAt: 0 };
  const saved = JSON.parse(JSON.stringify({ ...config, ...startTimer(config, 1000) }));
  // No intervals run while the page is unmounted. Returning reads wall time.
  assert.equal(timerState(saved, 30000).remaining, 31);
  assert.equal(timerState(saved, 70000).finished, true);
  const restored = { ...saved, ...completeTimer(saved, 70000) };
  assert.equal(restored.phase, 'break');
  assert.equal(timerState(restored, 900000).remaining, 300);
  assert.equal(timerState(restored, 900000).running, false);
});

test('leisure widgets tolerate persisted fractional indices and invalid text values', () => {
  assert.deepEqual(normalizeJokeConfig({ index: 1.5, text: 123 }, 5), { index: 1, text: '' });
  assert.deepEqual(normalizeJokeConfig({ index: Infinity, text: {} }, 5), { index: 0, text: '' });
  assert.deepEqual(normalizeJokeConfig({ index: -8, text: 'my words' }, 5), { index: 3, text: 'my words' });
  assert.deepEqual(normalizePhotoConfig({ photo: {}, caption: {} }), { photo: '', caption: '' });
  assert.deepEqual(normalizePhotoConfig({ photo: 'data:image/jpeg;base64,YQ==', caption: 'Sunset' }), { photo: 'data:image/jpeg;base64,YQ==', caption: 'Sunset' });
});
