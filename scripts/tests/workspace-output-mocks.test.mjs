import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { OUTPUT_DEMO_FILES, mergeOutputDemoData } from '../../src/personalized-home-2-0/ai-workspace/workspace-output-mocks.js';
import { getFileDownload } from '../../src/personalized-home-2-0/ai-workspace/file-actions.js';

test('saved output previews migrate to bundled WebP without losing edits', () => {
  const fixture = OUTPUT_DEMO_FILES[0];
  const saved = { ...fixture, title: 'My renamed output', image: fixture.image.replace(/\.webp$/, '.png'), format: 'PNG', favorite: true };
  const data = { files: [saved], assets: [], chats: [{ id: 'personal-chat' }] };
  const migrated = mergeOutputDemoData(data);
  const item = migrated.files.find(file => file.id === saved.id);
  assert.equal(item.image, fixture.image);
  assert.equal(item.format, 'WEBP');
  assert.equal(item.title, saved.title);
  assert.equal(item.favorite, true);
  assert.deepEqual(migrated.chats, data.chats);
  assert.equal(saved.format, 'PNG');
  assert.match(getFileDownload(item).filename, /\.webp$/);
});

test('custom replacement images survive demo migration', () => {
  const saved = { ...OUTPUT_DEMO_FILES[0], image: 'data:image/png;base64,custom', format: 'PNG' };
  assert.equal(mergeOutputDemoData({ files: [saved] }).files[0].image, saved.image);
  assert.equal(mergeOutputDemoData({ files: [saved] }).files[0].format, 'PNG');
});

test('every output fixture resolves to an existing bundled image', () => {
  for (const item of OUTPUT_DEMO_FILES) {
    assert.ok(existsSync(new URL(`../../public${item.image}`, import.meta.url)), item.image);
  }
});
