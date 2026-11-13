import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWidgetBoard, DEFAULT_WIDGET_BOARD_COLUMNS, DEFAULT_WIDGET_BOARD_VERSION } from '../../src/personalized-home-2-0/board/default-widget-board.js';
import { coreWidgetCatalog } from '../../src/personalized-home-2-0/board/core-widget-data.js';
import { extraWidgetCatalog } from '../../src/personalized-home-2-0/board/extra-widget-data.js';
import { leisureWidgetCatalog } from '../../src/personalized-home-2-0/board/leisure-widget-data.js';
import { audioWidgetCatalog } from '../../src/personalized-home-2-0/board/audio-widget-catalog.js';

const catalog = [...audioWidgetCatalog, ...coreWidgetCatalog, ...extraWidgetCatalog, ...leisureWidgetCatalog];
const starterLinks = Array.from({ length: 29 }, (_, index) => ({ id: `starter-${index}`, type: 'shortcut', key: `link-${index}`, label: `链接 ${index + 1}`, url: `https://example.com/${index}`, image: `icon-${index}.png`, size: { w: 1, h: 1 } }));
const emptyBoard = () => ({ id: 'group-1', name: '常用', items: [], layouts: {}, layoutVersion: 3 });

test('the default board includes every one of the 28 built-in widgets exactly once in Chinese', () => {
  const board = createDefaultWidgetBoard(emptyBoard(), starterLinks);
  const widgets = board.items.filter(item => item.type === 'widget');
  assert.equal(widgets.length, 28);
  assert.deepEqual(widgets.map(item => item.kind), catalog.map(item => item.kind));
  assert.equal(new Set(widgets.map(item => item.kind)).size, 28);
  assert.ok(widgets.every(item => item.config.locale === 'zh-CN'));
  assert.deepEqual(widgets.map(item => item.title), catalog.map(item => item.title));
  assert.equal(DEFAULT_WIDGET_BOARD_COLUMNS, 12);
  assert.equal(board.preferredColumns, 12);
  assert.equal(board.defaultWidgetBoardVersion, DEFAULT_WIDGET_BOARD_VERSION);
});

test('24 link entries occupy the first two rows and 6 by 4 widgets form pairs from row three', () => {
  const board = createDefaultWidgetBoard(emptyBoard(), starterLinks);
  const positions = board.layouts['gap:free:12'];
  const links = board.items.filter(item => item.type === 'shortcut');
  const widgets = board.items.filter(item => item.type === 'widget');
  assert.equal(links.length, 24);
  links.forEach((item, index) => {
    assert.deepEqual(item.size, { w: 1, h: 1 });
    assert.deepEqual(positions[item.id], { x: index % 12, y: Math.floor(index / 12) });
  });
  widgets.forEach((item, index) => {
    assert.deepEqual(item.size, { w: 6, h: 4 });
    assert.deepEqual(positions[item.id], { x: index % 2 * 6, y: 2 + Math.floor(index / 2) * 4 });
  });
  assert.deepEqual(board.layoutOrder, board.items.map(item => item.id));
  assert.deepEqual(Object.keys(board.layouts), ['gap:free:12']);
  const cells = new Set();
  for (const item of board.items) {
    const { x, y } = positions[item.id];
    assert.ok(x >= 0 && x + item.size.w <= 12);
    for (let dx = 0; dx < item.size.w; dx++) for (let dy = 0; dy < item.size.h; dy++) {
      const cell = `${x + dx},${y + dy}`;
      assert.ok(!cells.has(cell), `Items overlap at ${cell}`);
      cells.add(cell);
    }
  }
});

test('reuses saved identities, configuration and shortcut icons without changing input data', () => {
  const page = {
    ...emptyBoard(), id: 'my-board', name: '我的看板', customMetadata: 'retained', curatedLayoutVersion: 9,
    items: [
      { ...starterLinks[0], id: 'my-link', label: '我的链接', url: 'https://example.com/custom', customIcon: { kind: 'emoji', value: '🌿' }, size: { w: 3, h: 1 } },
      { id: 'my-todo', type: 'widget', kind: 'todo', title: '今日安排', config: { tasks: [{ id: 't1', text: '完成设计', done: false }], locale: 'en-US' }, size: { w: 2, h: 3 } },
      { id: 'extra-card', type: 'widget', kind: 'ai-card', config: { title: '另行保留' } },
    ],
    layouts: { 'gap:free:10': { 'my-todo': { x: 0, y: 0 } } },
  };
  const before = structuredClone(page), linksBefore = structuredClone(starterLinks);
  const board = createDefaultWidgetBoard(page, starterLinks);
  assert.deepEqual(page, before);
  assert.deepEqual(starterLinks, linksBefore);
  assert.equal(board.id, 'my-board');
  assert.equal(board.name, '我的看板');
  assert.equal(board.customMetadata, 'retained');
  assert.equal(board.layoutVersion, 3);
  assert.ok(!Object.hasOwn(board, 'curatedLayoutVersion'));
  const link = board.items.find(item => item.key === 'link-0');
  assert.equal(link.id, 'my-link');
  assert.equal(link.label, '我的链接');
  assert.equal(link.url, 'https://example.com/custom');
  assert.deepEqual(link.customIcon, before.items[0].customIcon);
  const todo = board.items.find(item => item.kind === 'todo');
  assert.equal(todo.id, 'my-todo');
  assert.equal(todo.title, '今日安排');
  assert.deepEqual(todo.config, before.items[1].config);
  todo.config.tasks[0].text = '修改输出';
  link.customIcon.value = '🌻';
  assert.deepEqual(page, before);
  assert.ok(!board.items.some(item => item.id === 'extra-card'));
});

test('legacy reminder text becomes a note and an existing note takes precedence', () => {
  const reminder = { id: 'old-reminder', type: 'widget', kind: 'reminder', title: '提醒', config: { lines: ['第一件事', { text: '第二件事' }] }, size: { w: 4, h: 3 } };
  const page = { ...emptyBoard(), items: [reminder] };
  const note = createDefaultWidgetBoard(page, starterLinks).items.find(item => item.kind === 'note');
  assert.equal(note.id, 'old-reminder');
  assert.equal(note.config.text, '第一件事\n第二件事');
  assert.deepEqual(reminder.config, { lines: ['第一件事', { text: '第二件事' }] });
  page.items.push({ id: 'current-note', type: 'widget', kind: 'note', config: { text: '已写下的内容' } });
  const preferred = createDefaultWidgetBoard(page, starterLinks).items.find(item => item.kind === 'note');
  assert.equal(preferred.id, 'current-note');
  assert.equal(preferred.config.text, '已写下的内容');
});

test('fewer starter links leave the reserved rows intact and generated identities remain stable and unique', () => {
  const collisionLinks = starterLinks.slice(0, 3).map(item => ({ ...item, id: 'default-widget-clock' }));
  const page = { ...emptyBoard(), items: [{ id: 'default-widget-clock', type: 'widget', kind: 'calendar', config: {} }] };
  const board = createDefaultWidgetBoard(page, collisionLinks);
  assert.equal(board.items.filter(item => item.type === 'shortcut').length, 3);
  assert.equal(new Set(board.items.map(item => item.id)).size, board.items.length);
  assert.equal(board.layouts['gap:free:12'][board.items.find(item => item.kind === 'clock').id].y, 2);
  assert.deepEqual(createDefaultWidgetBoard(page, collisionLinks), board);
  const fresh = createDefaultWidgetBoard(emptyBoard());
  assert.equal(fresh.items.length, 28);
  assert.ok(fresh.items.every(item => item.id === `default-widget-${item.kind}`));
});

test('IDs reserved by other boards are never reused and all geometry references the replacement IDs', () => {
  const page = { ...emptyBoard(), items: [{ id: 'saved-note', type: 'widget', kind: 'note', config: { text: '保留内容' } }] };
  const reserved = ['starter-0', 'starter-0-2', 'default-widget-clock', 'saved-note'];
  const board = createDefaultWidgetBoard(page, starterLinks, reserved);
  const ids = board.items.map(item => item.id);
  assert.ok(ids.every(id => !reserved.includes(id)));
  assert.equal(new Set(ids).size, board.items.length);
  assert.equal(board.items[0].id, 'starter-0-3');
  assert.equal(board.items.find(item => item.kind === 'clock').id, 'default-widget-clock-2');
  assert.equal(board.items.find(item => item.kind === 'note').id, 'saved-note-2');
  assert.equal(board.items.find(item => item.kind === 'note').config.text, '保留内容');
  assert.deepEqual(board.layoutOrder, ids);
  assert.deepEqual(Object.keys(board.layouts['gap:free:12']), ids);
  assert.deepEqual(board.layouts['gap:free:12']['starter-0-3'], { x: 0, y: 0 });
  assert.deepEqual(board.layouts['gap:free:12']['default-widget-clock-2'], { x: 6, y: 2 });
  assert.deepEqual(reserved, ['starter-0', 'starter-0-2', 'default-widget-clock', 'saved-note']);
});
