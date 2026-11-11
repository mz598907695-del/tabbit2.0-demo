import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureBookmarkRoots, migrateBookmarks, parseBookmarkLibrary, folderPath, bookmarkCommand } from '../../src/personalized-home-2-0/ai-workspace/bookmarks/bookmark-model.js';
import { supplementBookmarkDemo } from '../../src/personalized-home-2-0/ai-workspace/bookmarks/bookmark-demo.js';
import { bookmarkColumnGroups, bookmarkPresentation } from '../../src/personalized-home-2-0/ai-workspace/bookmarks/bookmark-navigation.js';

const initial = () => ensureBookmarkRoots(migrateBookmarks([{ id: 'my-saved', title: '我的资料', url: 'https://example.com/private-path', type: '设计', note: '保留我的备注' }]));
test('sample supplement preserves saved records and builds nested trees under both protected roots', () => {
  const before = initial(), snapshot = structuredClone(before), next = supplementBookmarkDemo(before);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(next.nodes.find(n => n.id === 'my-saved'), before.nodes.find(n => n.id === 'my-saved'));
  assert.ok(next.nodes.filter(n => n.kind === 'bookmark').length >= 60);
  for (const root of Object.values(next.rootIds)) {
    assert.ok(next.nodes.some(n => n.kind === 'bookmark' && folderPath(next.nodes, n.parentId).length >= 4 && folderPath(next.nodes, n.parentId)[0].id === root));
  }
  assert.doesNotThrow(() => parseBookmarkLibrary(next));
});
test('sample loading is idempotent and never refills deleted samples', () => {
  const data = supplementBookmarkDemo(initial());
  assert.equal(supplementBookmarkDemo(data), data);
  const sample = data.nodes.find(n => n.demo && n.kind === 'folder');
  const deleted = bookmarkCommand(data, { type: 'delete', ids: [sample.id] });
  assert.equal(supplementBookmarkDemo(deleted), deleted);
  assert.ok(deleted.nodes.find(n => n.id === sample.id).deletedAt);
});
test('sample ID collisions preserve existing IDs and assign correct new parent references', () => {
  const before = initial();
  before.nodes.push({ id: 'bm-demo-toolbar-work', kind: 'folder', title: '用户自己的目录', parentId: before.rootIds.toolbar });
  const next = supplementBookmarkDemo(before);
  assert.equal(next.nodes.find(n => n.id === 'bm-demo-toolbar-work').title, '用户自己的目录');
  const work = next.nodes.find(n => n.demo && n.title === '工作台');
  assert.notEqual(work.id, 'bm-demo-toolbar-work');
  assert.ok(next.nodes.some(n => n.title === '项目协作' && n.parentId === work.id));
  assert.doesNotThrow(() => parseBookmarkLibrary(next));
});
test('columns follow one root-to-folder path and respect each directory sort', () => {
  const library = supplementBookmarkDemo(initial());
  const deep = library.nodes.find(n => n.demo && n.title === 'React 生态');
  const groups = bookmarkColumnGroups(library, deep.id, { [deep.id]: 'name' });
  assert.deepEqual(groups.map(g => g.folder.title), ['导航栏', '开发工具', '前端开发', 'React 生态']);
  assert.ok(groups.every(g => g.rows.every(n => n.parentId === g.folder.id && !n.deletedAt)));
  assert.deepEqual(groups.at(-1).rows.map(n => n.title), ['Next.js 文档', 'Radix UI', 'React 文档']);
  const otherRoot = bookmarkColumnGroups(library, library.rootIds.folders);
  assert.equal(otherRoot.length, 1);
  assert.equal(otherRoot[0].folder.title, '收藏夹');
});
test('first entry and layout upgrade select and expand toolbar without resetting width or saved sorts', () => {
  const roots = initial().rootIds;
  const ui = bookmarkPresentation({ location: roots.folders, width: 280, sorts: { old: 'name' } }, roots);
  assert.equal(ui.location, roots.toolbar); assert.ok(ui.expanded.includes(roots.toolbar));
  assert.equal(ui.width, 280); assert.equal(ui.sorts.old, 'name');
  const saved = { ...ui, location: roots.folders, view: 'columns', expanded: [] };
  assert.deepEqual(bookmarkPresentation(saved, roots), saved);
});

test('toolbar icon-only preference defaults off and survives saving without changing folder navigation', () => {
  const roots = initial().rootIds;
  assert.equal(bookmarkPresentation({}, roots).toolbarIconsOnly, false);
  assert.equal(bookmarkPresentation({ toolbarIconsOnly: 'true' }, roots).toolbarIconsOnly, false);
  const saved = { ...bookmarkPresentation({}, roots), toolbarIconsOnly: true, location: roots.folders };
  assert.deepEqual(bookmarkPresentation(JSON.parse(JSON.stringify(saved)), roots), saved);
  assert.equal(bookmarkPresentation({ ...saved, toolbarIconsOnly: false }, roots).toolbarIconsOnly, false);
});
