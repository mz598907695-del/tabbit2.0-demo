import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpectrumSize, spectrumLibrarySizes } from '../../src/personalized-home-2-0/board/spectrum/widget-size.js';
import { createLibraryWidgetItem } from '../../src/personalized-home-2-0/board/widget-library-variants.js';
import { normalizeWidgetSize } from '../../src/personalized-home-2-0/board/widget-size.js';

test('drag, keyboard and library creation preserve a requested one-row summary', () => {
  const requested = { w: 1, h: 1 };
  for (const kind of ['clock', 'codex-usage', 'news', 'quote']) {
    for (const axis of [undefined, 'w', 'h']) {
      assert.deepEqual(normalizeSpectrumSize(kind, requested, { axis }), { w: 4, h: 1 });
    }
    const item = createLibraryWidgetItem({ kind, defaultConfig: {}, defaultSize: requested }, { id: kind, visualStyle: 'spectrum' });
    assert.deepEqual(item.size, { w: 4, h: 1 });
  }
  assert.deepEqual(requested, { w: 1, h: 1 });
});

test('content minimums follow the rounded height without restricting larger cards', () => {
  for (const kind of ['news', 'quote', 'joke', 'note', 'timetable', 'quick-links']) {
    assert.deepEqual(normalizeSpectrumSize(kind, { w: 1, h: 2 }), { w: 3, h: 2 });
  }
  assert.deepEqual(normalizeSpectrumSize('clock', { w: 1, h: 1.49 }), { w: 4, h: 1 });
  assert.deepEqual(normalizeSpectrumSize('clock', { w: 1, h: 1.5 }), { w: 2, h: 2 });
  assert.deepEqual(normalizeSpectrumSize('news', { w: 6, h: 4 }), { w: 6, h: 4 });
});

test('available board width wins over content minimums and never creates a single-cell card', () => {
  for (const maxWidth of [1, 2, 3, 4, 5]) {
    for (const kind of ['clock', 'news']) {
      for (const axis of [undefined, 'w', 'h']) {
        const size = normalizeSpectrumSize(kind, { w: 1, h: 1 }, { maxWidth, axis });
        assert.deepEqual(size, { w: Math.min(4, maxWidth), h: maxWidth === 1 ? 2 : 1 });
        assert.ok(size.w <= maxWidth);
      }
    }
  }
  assert.deepEqual(normalizeSpectrumSize('news', { w: 8, h: 2 }, { maxWidth: 2.9 }), { w: 2, h: 2 });
  assert.deepEqual(normalizeSpectrumSize('clock', { w: 99, h: 999 }), { w: 64, h: 128 });
});

test('partial input respects a valid fallback before applying the content minimum', () => {
  assert.deepEqual(normalizeSpectrumSize('clock', undefined, { fallback: { w: 5, h: 1 } }), { w: 5, h: 1 });
  assert.deepEqual(normalizeSpectrumSize('news', { w: NaN, h: Infinity }), { w: 3, h: 2 });
  assert.deepEqual(normalizeSpectrumSize('clock', { w: 2 }, { fallback: { w: 4, h: 1 } }), { w: 4, h: 1 });
});

test('images retain general sizing rules and classic library items stay unchanged', () => {
  for (const axis of [undefined, 'w', 'h']) {
    const requested = { w: 1, h: 1 };
    assert.deepEqual(normalizeSpectrumSize('image', requested, { axis }), normalizeWidgetSize(requested, { axis }));
  }
  assert.deepEqual(normalizeSpectrumSize('image', { w: 1, h: 4 }), { w: 1, h: 4 });
  const size = { w: 2, h: 1 };
  assert.deepEqual(createLibraryWidgetItem({ kind: 'news', defaultConfig: {} }, { id: 'classic-news', size }).size, size);
});

test('library options expose distinct normalized sizes while preserving labels and source data', () => {
  const choices = [{ w: 2, h: 1, label: '横卡' }, { w: 2, h: 2, label: '标准' }, { w: 4, h: 2, label: '宽卡' }];
  const before = structuredClone(choices);
  assert.deepEqual(spectrumLibrarySizes('news', choices), [
    { w: 4, h: 1, label: '横卡' }, { w: 3, h: 2, label: '标准' }, { w: 4, h: 2, label: '宽卡' },
  ]);
  assert.deepEqual(spectrumLibrarySizes('clock', [{ w: 1, h: 1, label: '横卡' }, { w: 2, h: 1, label: '重复' }]), [{ w: 4, h: 1, label: '横卡' }]);
  assert.deepEqual(choices, before);
});
