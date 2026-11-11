import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkCommand as command, canMoveTo, collectedLinks, copyBookmarkNodes, ensureBookmarkRoots, migrateBookmarks, parseBookmarkLibrary, projectWorkspaceBookmarks, viewBookmarks } from '../../src/personalized-home-2-0/ai-workspace/bookmarks/bookmark-model.js';
import { exportBookmarkHtml, bookmarkResourceList } from '../../src/personalized-home-2-0/ai-workspace/bookmarks/bookmark-io.js';

const fixture = () => ({ version:2, revision:'initial', nodes:[
  {id:'f',kind:'folder',title:'设计',parentId:null,order:0},
  {id:'nested',kind:'folder',title:'交互',parentId:'f',order:0},
  {id:'a',kind:'bookmark',title:'Alpha',url:'https://example.com/a',note:'框选交互',parentId:'nested',order:0,createdAt:100},
  {id:'b',kind:'bookmark',title:'Beta',url:'https://example.com/b',excerpt:'收藏体验',parentId:'f',order:1,createdAt:200},
  {id:'g',kind:'folder',title:'工作',parentId:null,order:1},
  {id:'c',kind:'bookmark',title:'Charlie',url:'https://example.com/c',parentId:'g',order:0,createdAt:300},
] });
const ids = nodes => nodes.map(node => node.id);
const byId = (library,id) => library.nodes.find(node => node.id === id);
const clock = {now:1000};

test('migration preserves edits, empty libraries, URL paths and unknown record fields', () => {
  assert.deepEqual(migrateBookmarks([]).nodes,[]);
  const saved = [{id:'saved',title:'我的标题',type:'研究',url:'https://example.com/path?q=1',note:'理由',custom:7}];
  const migrated = migrateBookmarks(saved), record=byId(migrated,'saved');
  assert.equal(record.url,saved[0].url); assert.equal(record.note,'理由'); assert.equal(record.custom,7);
  assert.equal(migrated.nodes.filter(node=>node.kind==='folder').length,1);
  assert.equal(saved[0].parentId,undefined);
});

test('folder views show direct children, search includes descendants and preserves scope', () => {
  const data=fixture();
  assert.deepEqual(ids(viewBookmarks(data,{location:'f'})),['nested','b']);
  assert.deepEqual(ids(viewBookmarks(data,{location:'f',query:'框选'})),['a']);
  assert.deepEqual(ids(viewBookmarks(data,{location:'f',query:'Charlie'})),[]);
  assert.deepEqual(ids(viewBookmarks(data,{location:'f',query:'Charlie',scope:'all'})),['c']);
  assert.deepEqual(ids(viewBookmarks(data,{location:'root',query:'收藏体验'})),['b']);
});

test('moving a folder and its child moves the subtree once and cannot create a cycle', () => {
  const before=fixture();
  const after=command(before,{type:'move',ids:['f','a'],parentId:'g'});
  assert.equal(byId(after,'f').parentId,'g'); assert.equal(byId(after,'a').parentId,'nested');
  assert.equal(byId(before,'f').parentId,null);
  assert.equal(canMoveTo(before,['f'],'nested'),false);
  assert.throws(()=>command(before,{type:'move',ids:['f'],parentId:'f'}));
  assert.throws(()=>command(before,{type:'move',ids:['a'],parentId:'gone'}));
});

test('manual reordering keeps the relative order of a moved group', () => {
  const data=fixture();
  data.nodes.push({id:'d',kind:'bookmark',title:'Delta',parentId:'f',url:'https://example.com/d',order:2});
  const next=command(data,{type:'move',ids:['b','d'],parentId:'f',beforeId:'nested'});
  assert.deepEqual(ids(viewBookmarks(next,{location:'f'})),['b','d','nested']);
  const back=command(next,{type:'move',ids:['b','d'],parentId:'f',afterId:'nested'});
  assert.deepEqual(ids(viewBookmarks(back,{location:'f'})),['nested','b','d']);
});

test('grouping creates a folder and relocates selected roots atomically', () => {
  const next=command(fixture(),{type:'group',ids:['a','b'],parentId:'f',id:'new',title:'参考'});
  assert.equal(byId(next,'new').parentId,'f'); assert.equal(byId(next,'a').parentId,'new'); assert.equal(byId(next,'b').parentId,'new');
});

test('deleting a subtree creates one trash root and excludes it from all searches', () => {
  const data=command(fixture(),{type:'delete',ids:['f','a']},clock);
  assert.deepEqual(ids(viewBookmarks(data,{location:'trash'})),['f']);
  assert.deepEqual(ids(viewBookmarks(data,{location:'all'})),['c']);
  assert.equal(byId(data,'a').trashRoot,'f');
  const restored=command(data,{type:'restore',ids:['f']},clock);
  assert.equal(byId(restored,'a').parentId,'nested'); assert.equal(byId(restored,'a').deletedAt,undefined);
  parseBookmarkLibrary(restored);
});

test('restoring a separately deleted child falls back to root if parent is still trashed', () => {
  let data=command(fixture(),{type:'delete',ids:['a']},clock);
  data=command(data,{type:'delete',ids:['f']},{now:2000});
  data=command(data,{type:'restore',ids:['a']});
  assert.equal(byId(data,'a').parentId,null); assert.ok(byId(data,'f').deletedAt); parseBookmarkLibrary(data);
});

test('purging parent repairs retained trash paths and never removes active records', () => {
  let data=command(fixture(),{type:'delete',ids:['a']},clock);
  data=command(data,{type:'delete',ids:['f']},{now:2000});
  data=command(data,{type:'purge',ids:['f','g']});
  assert.equal(byId(data,'f'),undefined); assert.ok(byId(data,'g')); assert.equal(byId(data,'a').parentId,null);
  parseBookmarkLibrary(data); data=command(data,{type:'restore',ids:['a']}); assert.equal(byId(data,'a').deletedAt,undefined);
});

test('copying folders assigns new identities, preserves structure and leaves originals intact', () => {
  const data=fixture(), copied=copyBookmarkNodes(data,['f','a']); let index=0;
  const next=command(data,{type:'copy',nodes:copied,parentId:'g'},{now:1000,id:()=>`copy-${index++}`});
  assert.equal(next.nodes.length,data.nodes.length+4);
  assert.equal(byId(next,'copy-0').parentId,'g'); assert.equal(byId(next,'copy-2').parentId,'copy-1');
  assert.equal(byId(next,'a').parentId,'nested'); assert.equal(byId(next,'copy-2').note,'框选交互');
});

test('editing and sorting preserve descriptions and do not rewrite shared arrays', () => {
  const data=fixture(); byId(data,'a').description='old description';
  const next=command(data,{type:'edit',id:'a',title:'新版',url:'https://example.com/new',note:'新理由',excerpt:'原文',later:true},clock);
  assert.equal(byId(next,'a').description,'old description'); assert.equal(byId(data,'a').title,'Alpha');
  assert.deepEqual(ids(viewBookmarks(next,{location:'later'})),['a']);
  assert.deepEqual(ids(viewBookmarks(next,{location:'all',sort:'oldest'})),['a','b','c']);
});

test('recently used contains only explicitly opened live bookmarks', () => {
  let data=command(fixture(),{type:'visit',ids:['a','b']},clock);
  data=command(data,{type:'delete',ids:['a']},{now:2000});
  assert.deepEqual(ids(viewBookmarks(data,{location:'recent'})),['b']);
});

test('invalid and script URLs cannot be created or restored from imports', () => {
  for(const url of ['javascript:alert(1)','data:text/html,boom','file:///tmp/test','not a url']) {
    assert.throws(()=>command(fixture(),{type:'create',kind:'bookmark',title:'坏地址',url,parentId:null}));
  }
  const data=fixture(); byId(data,'a').url='javascript:alert(1)';
  assert.equal(byId(parseBookmarkLibrary(data),'a').url,'');
});

test('invalid folder graphs, duplicate identities and corrupt input are rejected', () => {
  assert.throws(()=>parseBookmarkLibrary('bad json'));
  const cycle=fixture(); byId(cycle,'f').parentId='nested'; assert.throws(()=>parseBookmarkLibrary(cycle));
  const missing=fixture(); byId(missing,'a').parentId='gone'; assert.throws(()=>parseBookmarkLibrary(missing));
  const duplicate=fixture(); duplicate.nodes.push({...duplicate.nodes[0]}); assert.throws(()=>parseBookmarkLibrary(duplicate));
});

test('workspace projection uses canonical live data without changing other modules', () => {
  const data=command(fixture(),{type:'delete',ids:['f']},clock), workspace={bookmarks:[{id:'old'}],chats:[{id:'chat'}]};
  const projected=projectWorkspaceBookmarks(workspace,{getItem:()=>JSON.stringify(data)});
  assert.deepEqual(ids(projected.bookmarks),['c']); assert.equal(projected.chats,workspace.chats);
  assert.equal(projectWorkspaceBookmarks(workspace,{getItem:()=>null}),workspace);
  assert.equal(projectWorkspaceBookmarks(workspace,{getItem:()=>'{bad'}),workspace);
});

test('export safely escapes user text and keeps hierarchy, notes and only live data', () => {
  let data=fixture(); byId(data,'a').title='<script>"hi"</script>'; byId(data,'a').note='a & b';
  data=command(data,{type:'delete',ids:['g']},clock);
  const html=exportBookmarkHtml(data,['f','g']);
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('DATA-NOTE="a &amp; b"')); assert.ok(html.includes('<H3>交互</H3>')); assert.ok(!html.includes('Charlie'));
  assert.equal(collectedLinks(data,['f','a']).length,2);
  assert.ok(bookmarkResourceList([{title:'[link]',url:'https://example.com/(x)',note:'line1\nline2'}]).includes('%28x%29'));
});


test('two-root migration preserves existing records and is idempotent', () => {
  const before = fixture(), next = ensureBookmarkRoots(before);
  assert.deepEqual(next.nodes.filter(n => !n.parentId && !n.deletedAt).map(n => n.title), ['导航栏', '收藏夹']);
  assert.equal(byId(next, 'f').parentId, next.rootIds.folders);
  assert.equal(byId(next, 'a').parentId, 'nested');
  assert.equal(byId(next, 'a').note, '框选交互');
  assert.deepEqual(ensureBookmarkRoots(next), next);
  assert.equal(byId(before, 'f').parentId, null);
  assert.equal(ensureBookmarkRoots(migrateBookmarks([])).nodes.filter(n => n.kind === 'bookmark').length, 0);
});

test('fixed roots are protected and new content always belongs to one of them', () => {
  const data = ensureBookmarkRoots(fixture()), root = data.rootIds.folders;
  assert.equal(canMoveTo(data, [root], data.rootIds.toolbar), false);
  assert.throws(() => command(data, {type:'delete', ids:[root]}));
  assert.throws(() => command(data, {type:'edit', id:root, title:'替换'}));
  assert.throws(() => command(data, {type:'move', ids:[root], parentId:data.rootIds.toolbar}));
  const created = command(data, {type:'create', id:'new', kind:'folder', title:'新增', parentId:null});
  assert.equal(byId(created, 'new').parentId, root);
  const moved = command(data, {type:'move', ids:['f'], parentId:data.rootIds.toolbar});
  assert.equal(byId(moved, 'f').parentId, data.rootIds.toolbar);
  const snapshot = copyBookmarkNodes(data, [root]); let i=0;
  const imported = command(data, {type:'import', nodes:snapshot, parentId:null}, {id:()=>`import-${i++}`});
  assert.equal(imported.nodes.filter(n=>n.systemRoot).length, 2);
  assert.equal(imported.nodes.filter(n=>!n.parentId&&!n.deletedAt).length, 2);
});

test('root upgrade reuses matching folders and does not duplicate colliding IDs', () => {
  const data=fixture(); byId(data, 'g').title='导航栏';
  data.nodes.push({id:'bm-root-folders', kind:'bookmark', title:'保留', url:'https://example.com/keep', parentId:null});
  const next=ensureBookmarkRoots(data);
  assert.equal(next.rootIds.toolbar, 'g');
  assert.equal(byId(next, 'bm-root-folders').kind, 'bookmark');
  assert.notEqual(next.rootIds.folders, 'bm-root-folders');
  parseBookmarkLibrary(next);
  assert.equal(projectWorkspaceBookmarks({bookmarks:[]},{getItem:()=>JSON.stringify(next)}).bookmarks.find(n=>n.id==='a').type, '设计');
});
