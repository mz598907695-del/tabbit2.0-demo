import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpectrumWidgetBoard, ensureSpectrumWidgetBoard, SPECTRUM_WIDGET_BOARD_VERSION } from '../../src/personalized-home-2-0/board/default-widget-board.js';
import { sanitizeWidgetConfig } from '../../src/personalized-home-2-0/board/unified-widget-config.js';

const links = Array.from({ length: 28 }, (_, index) => ({ id: `link-${index}`, type: 'shortcut', key: `site-${index}`, url: `https://example.com/${index}`, label: `网站 ${index}` }));
const existing = () => [
  { id: 'personal', name: '我的看板', items: [{ id: 'saved-note', type: 'widget', kind: 'note', config: { text: '保留我的内容' }, size: { w: 2, h: 5 } }], layouts: { 'gap:free:12': { 'saved-note': { x: 9, y: 12 } } }, layoutOrder: ['saved-note'] },
  { id: 'another', name: '第二页', items: [], layouts: {} },
];

test('new collection contains 24 shortcuts then every spectrum widget, with audio first and two 6x4 cards per row', () => {
  const board = createSpectrumWidgetBoard(links);
  assert.equal(board.spectrumWidgetBoardVersion, SPECTRUM_WIDGET_BOARD_VERSION);
  assert.equal(board.defaultWidgetBoardVersion, undefined);
  assert.equal(board.items.length, 52);
  const widgets = board.items.slice(24);
  assert.equal(widgets[0].kind, 'audio-visualizer');
  assert.equal(new Set(widgets.map(item => item.kind)).size, 28);
  assert.ok(widgets.every(item => item.config.visualStyle === 'spectrum'));
  board.items.slice(0,24).forEach((item,index) => {
    assert.equal(item.type, 'shortcut');
    assert.deepEqual(item.size, { w: 1, h: 1 });
    assert.deepEqual(board.layouts['gap:free:12'][item.id], { x: index%12, y: Math.floor(index/12) });
  });
  widgets.forEach((item,index) => {
    assert.deepEqual(item.size, { w: 6, h: 4 });
    assert.deepEqual(board.layouts['gap:free:12'][item.id], { x: index%2*6, y: 2+Math.floor(index/2)*4 });
    assert.equal(sanitizeWidgetConfig(JSON.parse(JSON.stringify(item.config))).visualStyle, 'spectrum');
  });
  assert.deepEqual(board.layoutOrder, board.items.map(item => item.id));
});

test('one-time migration inserts at position two without changing any existing page, widget data or coordinates', () => {
  const pages=existing(), before=structuredClone(pages);
  const result=ensureSpectrumWidgetBoard(pages,links);
  assert.equal(result.added,true);
  assert.equal(result.pages.length,3);
  assert.equal(result.pages[0],pages[0]);
  assert.equal(result.pages[2],pages[1]);
  assert.equal(result.pages[1].name,'光谱');
  assert.deepEqual(pages,before);
  assert.equal(result.spectrumWidgetBoardVersion,SPECTRUM_WIDGET_BOARD_VERSION);
  const repeated=ensureSpectrumWidgetBoard(result.pages,links,result.spectrumWidgetBoardVersion);
  assert.equal(repeated.pages,result.pages);
  assert.equal(repeated.added,false);
});

test('renamed/reordered collection is recognized and a deliberately deleted collection stays deleted', () => {
  const first=ensureSpectrumWidgetBoard(existing(),links);
  const reordered=[{...first.pages[1],name:'我的新风格'},first.pages[0],first.pages[2]];
  const withoutTopLevelMarker=ensureSpectrumWidgetBoard(reordered,links);
  assert.equal(withoutTopLevelMarker.pages,reordered);
  assert.equal(withoutTopLevelMarker.added,false);
  const deleted=reordered.slice(1);
  const result=ensureSpectrumWidgetBoard(deleted,links,first.spectrumWidgetBoardVersion);
  assert.equal(result.pages,deleted);
  assert.equal(result.added,false);
});

test('generated identities cannot collide with personal board/item IDs', () => {
  const pages=existing();
  pages[0].id='spectrum-widget-board-v1';
  pages[0].items.push({id:'spectrum-widget-clock',type:'widget',kind:'clock',config:{}});
  pages[1].items.push({...links[0],id:'spectrum-link-site-0'});
  const result=ensureSpectrumWidgetBoard(pages,links);
  assert.equal(result.pages[1].id,'spectrum-widget-board-v1-2');
  const ids=result.pages.flatMap(page=>page.items.map(item=>item.id));
  assert.equal(new Set(ids).size,ids.length);
  const clock=result.pages[1].items.find(item=>item.kind==='clock');
  assert.equal(clock.id,'spectrum-widget-clock-2');
  assert.deepEqual(result.pages[1].layouts['gap:free:12'][clock.id],{x:6,y:2});
});

test('maximum board count defers migration instead of dropping a saved board', () => {
  const pages=Array.from({length:20},(_,index)=>({id:`board-${index}`,name:`看板${index}`,items:[]}));
  const full=ensureSpectrumWidgetBoard(pages,links);
  assert.equal(full.pages,pages);
  assert.equal(full.spectrumWidgetBoardVersion,0);
  assert.equal(full.added,false);
  const afterRemoval=ensureSpectrumWidgetBoard(pages.slice(1),links,full.spectrumWidgetBoardVersion);
  assert.equal(afterRemoval.pages.length,20);
  assert.equal(afterRemoval.added,true);
});

test('bundled defaults open classic board first and spectrum second with paired complete collections', async () => {
  const { readFile }=await import('node:fs/promises');
  const defaults=JSON.parse(await readFile(new URL('../../src/demo-defaults.json',import.meta.url),'utf8'));
  const saved=JSON.parse(defaults.storage['personalized-home-2-0-board-v1']);
  const [classic,spectrum]=saved.pages;
  assert.equal(classic.name,'常用');
  assert.equal(spectrum.name,'光谱');
  assert.equal(saved.spectrumWidgetBoardVersion,SPECTRUM_WIDGET_BOARD_VERSION);
  assert.equal(defaults.storage['personalized-home-2-0-board-active-id'],classic.id);
  assert.equal(defaults.storage['personalized-home-2-0-board-index'],'0');
  for(const page of [classic,spectrum]) {
    assert.equal(page.items.filter(item=>item.type==='shortcut').length,24);
    const widgets=page.items.filter(item=>item.type==='widget');
    assert.equal(widgets.length,28);
    assert.equal(widgets[0].kind,'audio-visualizer');
    assert.ok(widgets.every(item=>item.size.w===6&&item.size.h===4));
    assert.deepEqual(page.layouts['gap:free:12'][widgets[0].id],{x:0,y:2});
  }
  assert.deepEqual(classic.items.filter(item=>item.type==='widget').map(item=>item.kind),spectrum.items.filter(item=>item.type==='widget').map(item=>item.kind));
  const ids=saved.pages.flatMap(page=>page.items.map(item=>item.id));
  assert.equal(new Set(ids).size,ids.length);
});
