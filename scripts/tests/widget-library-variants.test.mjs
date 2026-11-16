import test from 'node:test';
import assert from 'node:assert/strict';
import { coreWidgetCatalog } from '../../src/personalized-home-2-0/board/core-widget-data.js';
import { extraWidgetCatalog } from '../../src/personalized-home-2-0/board/extra-widget-data.js';
import { leisureWidgetCatalog } from '../../src/personalized-home-2-0/board/leisure-widget-data.js';
import { audioWidgetCatalog } from '../../src/personalized-home-2-0/board/audio-widget-catalog.js';
import { widgetLibraryVariants, createLibraryWidgetItem } from '../../src/personalized-home-2-0/board/widget-library-variants.js';
import { sanitizeWidgetConfig } from '../../src/personalized-home-2-0/board/unified-widget-config.js';

const catalog = [...coreWidgetCatalog, ...extraWidgetCatalog, ...leisureWidgetCatalog, ...audioWidgetCatalog];

test('the library pairs all 28 classic and spectrum widgets with audio first', () => {
  const before = catalog.map(entry => entry.kind);
  const variants = widgetLibraryVariants(catalog);
  assert.equal(variants.length, 56);
  assert.equal(new Set(variants.map(entry => entry.libraryKey)).size, 56);
  assert.equal(variants[0].kind, 'audio-visualizer');
  for (let index = 0; index < variants.length; index += 2) {
    const [classic, spectrum] = variants.slice(index, index + 2);
    assert.equal(classic.kind, spectrum.kind);
    assert.equal(classic.title, spectrum.title);
    assert.deepEqual([classic.visualStyle, spectrum.visualStyle], ['classic', 'spectrum']);
  }
  assert.deepEqual(catalog.map(entry => entry.kind), before);
});

test('adding a spectrum item keeps its real defaults and style through storage without mutating the classic definition', () => {
  const definition = catalog.find(entry => entry.kind === 'todo');
  const before = structuredClone(definition.defaultConfig);
  const size = { w: 6, h: 4 };
  const spectrum = createLibraryWidgetItem(definition, { id: 'new-todo', size, visualStyle: 'spectrum' });
  const classic = createLibraryWidgetItem(definition, { id: 'old-todo', size });
  assert.equal(spectrum.kind, classic.kind);
  assert.equal(spectrum.config.visualStyle, 'spectrum');
  assert.equal(sanitizeWidgetConfig(JSON.parse(JSON.stringify(spectrum.config))).visualStyle, 'spectrum');
  assert.equal(classic.config.visualStyle, undefined);
  assert.deepEqual(definition.defaultConfig, before);
  assert.deepEqual(spectrum.size, size);
});
