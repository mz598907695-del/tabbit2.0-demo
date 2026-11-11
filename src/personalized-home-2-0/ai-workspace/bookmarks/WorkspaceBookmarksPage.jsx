import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, PanelTop, Check, ChevronRight, Copy, Download, Ellipsis, Folder, FolderPlus, ListFilter, List, Pencil, Plus, Search, Trash2, Undo2, X } from '../../icons';
import { FoldVertical, UnfoldVertical, Columns3, CornerUpLeft, FolderInput, Import, Scissors } from 'lucide-react';
import BookmarkMenu from './BookmarkMenu';
import BookmarkBarPreview from './BookmarkBarPreview';
import BookmarkTree from './BookmarkTree';
import BookmarkHelp from './BookmarkHelp';
import BookmarkRow from './BookmarkRow';
import BookmarkColumns from './BookmarkColumns';
import BookmarkBatchToolbar from './BookmarkBatchToolbar';
import { bookmarkColumnGroups, bookmarkPresentation } from './bookmark-navigation';
import SidebarToggleIcon from '../SidebarToggleIcon';
import { BookmarkConfirmDialog, BookmarkEditDialog, BookmarkMoveDialog, BookmarkTextDialog } from './BookmarkDialogs';
import useBookmarkLibrary from './useBookmarkLibrary';
import useBookmarkGestures from './useBookmarkGestures';
import { BOOKMARK_UI_KEY, collectedLinks, copyBookmarkNodes, folderPath, liveNodes, makeId, selectionRoots, viewBookmarks } from './bookmark-model';
import { downloadBookmarkFile, exportBookmarkHtml, importBookmarkText } from './bookmark-io';
import './workspace-bookmarks.css';

const SORT_NAMES = { manual: '手动排序', recent: '最近添加', oldest: '最早添加', name: '名称排序' };
const SEPARATOR = { separator: true };
function readUI(rootIds) {
  try { return bookmarkPresentation(JSON.parse(localStorage.getItem(BOOKMARK_UI_KEY) || '{}'), rootIds); }
  catch { return bookmarkPresentation({}, rootIds); }
}

export default function WorkspaceBookmarksPage({ embedded = false, active = true } = {}) {
  const { library, commit, undo, undoCount, storageError } = useBookmarkLibrary();
  const [ui, setUI] = useState(() => readUI(library.rootIds)), [query, setQuery] = useState(''), [searchOpen, setSearchOpen] = useState(false), [scope, setScope] = useState('current'), [kind, setKind] = useState('all');
  const [selection, setSelection] = useState([]), [menu, setMenu] = useState(null), [dialog, setDialog] = useState(null), [notice, setNotice] = useState(null), [clipboard, setClipboard] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => !matchMedia('(max-width: 760px)').matches), [compact, setCompact] = useState(() => matchMedia('(max-width: 760px)').matches);
  const shellRef = useRef(null), listRef = useRef(null), searchRef = useRef(null), searchToggleRef = useRef(null), importRef = useRef(null), anchorRef = useRef(null), rowAnchor = useRef(null), resize = useRef(null);
  const sidebarWasOpen = useRef(sidebarOpen);
  const live = useMemo(() => liveNodes(library), [library]);
  const location = ui.location, parentId = location;
  const folder = live.find(node => node.id === location);
  const sort = ui.sorts[location] || 'manual';
  const rows = useMemo(() => viewBookmarks(library, { location, query, scope, sort, kind }), [library, location, query, scope, sort, kind]);
  const isColumns = ui.view === 'columns' && !query;
  const groups = useMemo(() => bookmarkColumnGroups(library, location, ui.sorts, kind), [library, location, ui.sorts, kind]);
  const selectableNodes = useMemo(() => isColumns ? groups.flatMap(group => group.rows) : rows, [isColumns, groups, rows]);
  const selected = useMemo(() => new Set(selection), [selection]), selectedNodes = live.filter(node => selected.has(node.id));
  const directCounts = useMemo(() => { const result = {}; live.forEach(node => { result[node.parentId] = (result[node.parentId] || 0) + 1; }); return result; }, [live]);
  const path = folderPath(library.nodes, parentId), allSelected = !!rows.length && rows.every(node => selected.has(node.id));
  const counts = useMemo(() => {
    const result = {};
    live.filter(node => node.kind === 'bookmark').forEach(node => folderPath(live, node.parentId).forEach(parent => { result[parent.id] = (result[parent.id] || 0) + 1; }));
    return result;
  }, [live]);
  const gestures = useBookmarkGestures({ library, live, ui, setUI, selection, setSelection, parentId, smart: false, query, sort, kind, trash: false, listRef, move, notify, blocked: storageError || !!menu });
  const { dragging, dragProps, dropProps, marquee, marqueeHandlers } = gestures;

  useEffect(() => {
    const narrow = matchMedia('(max-width: 760px)');
    const responsive = () => { setCompact(narrow.matches); if (narrow.matches) setSidebarOpen(false); };
    narrow.addEventListener('change', responsive);
    return () => narrow.removeEventListener('change', responsive);
  }, []);
  useEffect(() => { if (!active) { setMenu(null); setDialog(null); setNotice(null); } }, [active]);
  useEffect(() => { try { localStorage.setItem(BOOKMARK_UI_KEY, JSON.stringify(ui)); } catch { /* optional presentation preferences */ } }, [ui]);
  useEffect(() => { if (!folder) { setUI(previous => ({ ...previous, location: library.rootIds.toolbar })); setSelection([]); } }, [location, folder, library.rootIds.toolbar]);
  useEffect(() => { setSelection(previous => previous.filter(id => selectableNodes.some(node => node.id === id))); }, [selectableNodes]);
  useEffect(() => {
    if (!isColumns || selection.length !== 1 || marquee || dragging) return;
    const node = live.find(item => item.id === selection[0]);
    if (node?.kind !== 'folder' || node.id === location) return;
    setUI(previous => ({ ...previous, location: node.id, expanded: [...new Set([...previous.expanded, ...folderPath(live, node.id).map(item => item.id)])] }));
  }, [isColumns, selection, live, location, Boolean(marquee), Boolean(dragging)]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.error ? 10000 : 6000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (compact && sidebarOpen) shellRef.current?.querySelector('.bkm-sidebar button')?.focus();
    else if (compact && sidebarWasOpen.current) shellRef.current?.querySelector('.bkm-topbar button[aria-label="展开目录"]')?.focus();
    sidebarWasOpen.current = sidebarOpen;
  }, [compact, sidebarOpen]);

  function notify(message, error = false) { setNotice({ message, error }); }
  function perform(command, label, options) {
    const changed = commit(command, label, options);
    if (changed) { notify(label); setSelection([]); } else notify('所选内容已在这个位置');
    return changed;
  }
  function safely(action) { try { return action(); } catch (error) { notify(error.message || '操作失败，请重试。', true); return false; } }
  function doUndo() { safely(() => { const label = undo(); if (label) { notify(`已撤销：${label}`); setSelection([]); } }); }
  function navigate(next, { keepQuery = false } = {}) {
    setUI(previous => ({ ...previous, location: next, expanded: [...new Set([...previous.expanded, ...folderPath(live, next).slice(0, -1).map(node => node.id)])] }));
    if (!keepQuery) setQuery(''); setKind('all'); setSelection([]); rowAnchor.current = null;
    if (compact) setSidebarOpen(false);
    if (listRef.current) listRef.current.scrollTop = 0;
  }
  function toggleFolder(id) { setUI(previous => ({ ...previous, expanded: previous.expanded.includes(id) ? previous.expanded.filter(value => value !== id) : [...previous.expanded, id] })); }
  function select(id, event = {}, toggle = true, siblings = rows, initialAnchor) {
    if (initialAnchor && !rowAnchor.current) rowAnchor.current = initialAnchor;
    if (event.shiftKey && rowAnchor.current && siblings.some(node => node.id === rowAnchor.current)) {
      const start = siblings.findIndex(node => node.id === rowAnchor.current), end = siblings.findIndex(node => node.id === id), range = siblings.slice(Math.min(start, end), Math.max(start, end) + 1).map(node => node.id);
      setSelection(event.metaKey || event.ctrlKey ? [...new Set([...selection, ...range])] : range);
    } else { setSelection(previous => toggle || event.metaKey || event.ctrlKey ? previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id] : [id]); rowAnchor.current = id; }
  }
  function toggleColumn(columnRows) {
    const ids = new Set(columnRows.map(node => node.id));
    setSelection(previous => columnRows.length && columnRows.every(node => previous.includes(node.id))
      ? previous.filter(id => !ids.has(id)) : [...new Set([...previous, ...ids])]);
  }
  function toggleAll() { setSelection(allSelected ? [] : rows.map(node => node.id)); }
  function rememberTarget(id) { if (id) setUI(previous => ({ ...previous, recentFolders: [id, ...previous.recentFolders.filter(value => value !== id)].slice(0, 5), expanded: [...new Set([...previous.expanded, ...folderPath(live, id).map(node => node.id)])] })); }
  function move(ids, destination, position = {}) {
    const changed = perform({ type: 'move', ids, parentId: destination, ...position }, position.beforeId || position.afterId ? '已调整顺序' : `已移动 ${selectionRoots(live, ids).length} 项`);
    if (changed) { rememberTarget(destination); if (clipboard?.mode === 'cut' && ids.some(id => clipboard.ids.includes(id))) setClipboard(null); }
    return changed;
  }
  function createAction(kind = 'bookmark', target = parentId) { setDialog({ type: 'edit', kind, parentId: target }); }
  function moveAction(ids) { setDialog({ type: 'move', ids, parentId }); }
  function groupAction(ids) { setDialog({ type: 'group', ids, kind: 'folder', parentId }); }
  function deleteAction(ids) {
    const roots = selectionRoots(live, ids), contents = collectedLinks(library, ids), folders = roots.filter(node => node.kind === 'folder');
    if (!roots.length || roots.some(node => node.systemRoot)) return;
    setDialog({ type: 'confirm', title: `删除 ${roots.length} 项？`, message: folders.length ? `包含 ${folders.length} 个文件夹，共 ${contents.length} 条收藏（含子文件夹）。` : `将删除所选的 ${roots.length} 条收藏。`, detail: '删除后可通过操作提示或快捷键撤销，刷新页面后不再提供撤销。', confirmLabel: '删除', danger: true, execute: () => perform({ type: 'delete', ids }, `已删除 ${roots.length} 项`) });
  }
  function clipboardAction(ids, mode) {
    const roots = selectionRoots(live, ids);
    setClipboard({ mode, ids: roots.map(node => node.id), nodes: copyBookmarkNodes(library, ids) });
    notify(mode === 'cut' ? `已剪切 ${roots.length} 项，前往目标目录后粘贴` : `已复制 ${roots.length} 项`);
  }
  function paste(destination = parentId) {
    if (!clipboard) return;
    safely(() => {
      if (clipboard.mode === 'cut') {
        if (!clipboard.ids.every(id => live.some(node => node.id === id))) throw new Error('剪切内容已改变，请重新选择。');
        move(clipboard.ids, destination); setClipboard(null);
      } else perform({ type: 'copy', nodes: clipboard.nodes, parentId: destination }, '已粘贴收藏');
    });
  }
  async function copyText(value, message) {
    try { await navigator.clipboard.writeText(value); notify(message); }
    catch { setDialog({ type: 'text', title: message.replace('已复制', '复制'), value }); }
  }
  function copyLinks(ids) {
    const links = collectedLinks(library, ids).filter(node => node.url);
    copyText(links.map(node => node.url).join('\n'), `已复制 ${links.length} 个链接`);
  }
  function openLinks(ids) {
    const links = collectedLinks(library, ids).filter(node => node.url), urls = [...new Set(links.map(node => node.url))];
    if (!urls.length) { notify('没有可打开的网址，请先编辑收藏。', true); return; }
    const execute = () => {
      const opened = [];
      urls.forEach(url => { const tab = window.open(url, '_blank'); if (tab) { tab.opener = null; opened.push(url); } });
      if (opened.length) safely(() => commit({ type: 'visit', ids: links.filter(node => opened.includes(node.url)).map(node => node.id) }, '已打开收藏', { undoable: false }));
      if (opened.length < urls.length) notify(`已打开 ${opened.length} 个链接，其余被浏览器拦截。可允许本站弹出窗口后重试，或复制链接。`, true);
    };
    if (urls.length > 10) setDialog({ type: 'confirm', title: `打开 ${urls.length} 个网页？`, message: '将打开所选文件夹及子文件夹中的链接，同网址只打开一次。', confirmLabel: '打开网页', execute });
    else execute();
  }
  function openNode(node) { if (!node.deletedAt) node.kind === 'folder' ? navigate(node.id) : openLinks([node.id]); }
  function exportItems(ids, format = 'html') {
    const content = format === 'html' ? exportBookmarkHtml(library, ids) : JSON.stringify({ version: 2, nodes: copyBookmarkNodes(library, ids) }, null, 2);
    downloadBookmarkFile(content, `Tabbit-收藏.${format}`, format === 'html' ? 'text/html;charset=utf-8' : 'application/json'); notify('收藏文件已生成');
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notify('请导入小于 10 MB 的收藏文件。', true); return; }
    try {
      const result = importBookmarkText(await file.text(), new DOMParser(), file.name), folderId = makeId();
      const nodes = [{ id: folderId, kind: 'folder', title: `导入 · ${file.name.replace(/\.(html?|json)$/i, '')}`, parentId: null, order: 0 }, ...result.nodes.map(node => ({ ...node, parentId: node.parentId || folderId }))];
      const bookmarks = result.nodes.filter(node => node.kind === 'bookmark').length, folders = result.nodes.filter(node => node.kind === 'folder').length;
      setDialog({ type: 'confirm', title: '导入收藏', message: `将导入 ${bookmarks} 条收藏、${folders} 个文件夹，保留原目录层级。`, detail: `内容放入「${nodes[0].title}」，不会合并或覆盖现有收藏。${result.skipped ? `已跳过 ${result.skipped} 个非 HTTP / HTTPS 地址。` : ''}`, confirmLabel: '确认导入', execute: () => { perform({ type: 'import', nodes, parentId: library.rootIds.folders }, `已导入 ${bookmarks} 条收藏`); navigate(library.rootIds.folders); } });
    } catch (error) { notify(error.message, true); }
  }
  function closeMenu(restore = false) { setMenu(null); if (restore && anchorRef.current?.isConnected) anchorRef.current.focus?.({ preventScroll: true }); }
  function showMenu(event, label, items, caption) {
    event.preventDefault(); event.stopPropagation();
    const anchor = event.target.closest('button,[tabindex]') || event.currentTarget; anchorRef.current = anchor;
    const rect = anchor.getBoundingClientRect(), pointer = event.type === 'contextmenu' && (event.clientX || event.clientY);
    setMenu({ label, items, caption, x: pointer ? event.clientX : rect.left, y: pointer ? event.clientY : rect.bottom + 4 });
  }
  function itemMenu(event, ids, node) {
    if (!node) return;
    const fromTree = !!event.currentTarget.closest('.bkm-sidebar'), actual = !fromTree && selected.has(node.id) ? selection : ids;
    if (!fromTree && !selected.has(node.id)) setSelection(actual);
    const links = collectedLinks(library, actual).filter(node => node.url), single = actual.length === 1, isFolder = single && node.kind === 'folder';
    const fixedRoot = !!node.systemRoot;
    showMenu(event, single ? `${node.title} 操作` : '批量收藏操作', [
      ...(isFolder ? [{ label: '进入文件夹', icon: Folder, action: () => navigate(node.id) }] : []),
      { label: single && !isFolder ? '在新标签页打开' : `打开 ${new Set(links.map(item => item.url)).size} 个链接`, icon: ArrowUpRight, disabled: !links.length, action: () => openLinks(actual) }, SEPARATOR,
      ...(single && !fixedRoot ? [{ label: isFolder ? '重命名' : '编辑收藏', icon: Pencil, action: () => setDialog({ type: 'edit', node }) }] : []),
      ...(isFolder ? [{ label: '新建子文件夹', icon: FolderPlus, action: () => createAction('folder', node.id) }, { label: '添加收藏到此处', icon: Plus, action: () => createAction('bookmark', node.id) }] : []),
      ...(!fixedRoot ? [{ label: '移动到…', icon: FolderInput, action: () => moveAction(actual) }, { label: '放入新文件夹…', icon: FolderPlus, action: () => groupAction(actual) }] : []),
      SEPARATOR,
      ...(!fixedRoot ? [{ label: '剪切', icon: Scissors, shortcut: '⌘/Ctrl X', action: () => clipboardAction(actual, 'cut') }, { label: '复制收藏', icon: Copy, shortcut: '⌘/Ctrl C', action: () => clipboardAction(actual, 'copy') }] : []),
      ...(isFolder ? [{ label: '粘贴到此处', icon: CornerUpLeft, disabled: !clipboard, action: () => paste(node.id) }] : []),
      ...(isFolder ? [{ label: '导出此文件夹', icon: Download, action: () => exportItems(actual) }] : []),
      ...(!fixedRoot ? [SEPARATOR, { label: '删除', icon: Trash2, danger: true, action: () => deleteAction(actual) }] : []),
    ], single ? undefined : `已选择 ${actual.length} 项`);
  }
  function backgroundMenu(event) {
    if (event.target.closest('[data-bookmark-id],button,input,.home-context-menu')) return;
    const target = event.target.closest('[data-column-id]')?.dataset.columnId || parentId;
    const contents = live.filter(node => node.parentId === target);
    showMenu(event, '当前目录操作', [{ label: '添加收藏', icon: Plus, action: () => createAction('bookmark', target) }, { label: '新建文件夹', icon: FolderPlus, action: () => createAction('folder', target) }, SEPARATOR, { label: '粘贴', icon: CornerUpLeft, disabled: !clipboard, action: () => paste(target) }, { label: '全选', icon: Check, disabled: !contents.length, action: () => setSelection(contents.map(node => node.id)) }]);
  }
  function exportMenu(event) {
    const rootIds = live.filter(node => !node.parentId).map(node => node.id);
    showMenu(event, '导出收藏', [
      { label: '当前文件夹（HTML）', action: () => exportItems([location]) },
      { label: '全部收藏（HTML）', action: () => exportItems(rootIds) },
      { label: '收藏备份（JSON）', action: () => exportItems(rootIds, 'json') },
    ]);
  }
  function libraryMenu(event) {
    showMenu(event, '收藏更多操作', [
      { label: '添加收藏…', icon: Plus, action: () => createAction() },
      { label: clipboard ? `粘贴 ${clipboard.ids.length} 项到当前目录` : '粘贴到当前目录', icon: CornerUpLeft, disabled: !clipboard, action: () => paste() },
      ...(clipboard ? [{ label: clipboard.mode === 'cut' ? '取消剪切' : '取消复制', icon: X, action: () => setClipboard(null) }] : []), SEPARATOR,
      { label: '排序方式', icon: ArrowDownUp, children: Object.entries(SORT_NAMES).map(([key, label]) => ({ label, checked: sort === key, action: () => { setUI(previous => ({ ...previous, sorts: { ...previous.sorts, [location]: key } })); setSelection([]); } })) },
      { label: '筛选内容类型', icon: ListFilter, children: [['all', '全部类型'], ['folder', '文件夹'], ['bookmark', '网页收藏']].map(([key, label]) => ({ label, checked: kind === key, action: () => { setKind(key); setSelection([]); } })) }, SEPARATOR,
      { label: '展开所有文件夹', icon: UnfoldVertical, action: () => setUI(previous => ({ ...previous, expanded: live.filter(node => node.kind === 'folder').map(node => node.id) })) },
      { label: '收起所有文件夹', icon: FoldVertical, action: () => setUI(previous => ({ ...previous, expanded: [] })) },
      SEPARATOR, { label: '导航栏仅显示图标', icon: PanelTop, toggle: true, checked: ui.toolbarIconsOnly, action: checked => setUI(previous => ({ ...previous, toolbarIconsOnly: checked })), preview: checked => <BookmarkBarPreview nodes={viewBookmarks(library, { location: library.rootIds.toolbar })} iconsOnly={checked}/> },
    ]);
  }
  function closeSearch() { setQuery(''); setSearchOpen(false); requestAnimationFrame(() => searchToggleRef.current?.focus()); }
  function changeView(view) { gestures.cancelGesture(); setSelection([]); setUI(previous => ({ ...previous, view })); }
  const rowProps = { select, openNode, navigate, itemMenu, dragProps, dropProps, selecting: selection.length > 0 };
  function onKeyboard(event) {
    if (event.target.closest('input:not([type="checkbox"]),textarea,select,[contenteditable="true"],dialog,.home-context-menu')) return;
    if (event.key === 'Escape') { if (compact && sidebarOpen) setSidebarOpen(false); else if (marquee || dragging) gestures.cancelGesture(event); else if (selection.length) setSelection([]); else if (query) setQuery(''); return; }
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); doUndo(); }
    if (command && event.key.toLowerCase() === 'a' && event.target.closest('.bkm-main')) { event.preventDefault(); setSelection(rows.map(node => node.id)); }
    if (command && ['c', 'x'].includes(event.key.toLowerCase()) && selection.length) { event.preventDefault(); clipboardAction(selection, event.key.toLowerCase() === 'c' ? 'copy' : 'cut'); }
    if (command && event.key.toLowerCase() === 'v' && clipboard) { event.preventDefault(); paste(); }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selection.length && event.target.closest('.bkm-main')) { event.preventDefault(); deleteAction(selection); }
    if (event.key === 'F2' && selection.length === 1) { event.preventDefault(); setDialog({ type: 'edit', node: live.find(node => node.id === selection[0]) }); }
  }
  return <div ref={shellRef} className={`bkm-app${embedded ? ' is-embedded' : ''}${sidebarOpen ? ' has-sidebar' : ''}${compact ? ' is-compact' : ''}${dragging ? ' is-dragging' : ''}${selection.length ? ' has-selection' : ''}`} style={{ '--bkm-sidebar-width': `${ui.width}px` }} onKeyDown={onKeyboard}>
    {compact && sidebarOpen && <button className="bkm-sidebar-backdrop" aria-label="关闭目录" onClick={() => setSidebarOpen(false)}/>}
    <aside className="bkm-sidebar" hidden={!sidebarOpen} aria-label="收藏导航" onKeyDown={event => {
      if (!compact || event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('a[href],button:not(:disabled),input')].filter(node => node.getClientRects().length), first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className="bkm-sidebar-header"><a className="bkm-icon bkm-home" href="./" aria-label="返回首页" title="返回首页"><img src="/personalized-home-2-0/asset/icons/tabbit-solid.svg" alt="" width="20" height="20" draggable="false"/></a><h1>收藏</h1><button className="bkm-icon" aria-label="收起目录" onClick={() => { setSidebarOpen(false); requestAnimationFrame(() => shellRef.current?.querySelector('[aria-label="展开目录"]')?.focus()); }}><SidebarToggleIcon size={18}/></button></header>
      <div className="bkm-tree-scroll">
        <BookmarkTree nodes={live} expanded={ui.expanded} location={location} counts={counts} onToggle={toggleFolder} onNavigate={navigate} onMenu={itemMenu} dragProps={dragProps} dropProps={dropProps}/>
      </div>
      {!compact && <div className="bkm-resizer" role="separator" aria-label="调整收藏目录宽度" aria-orientation="vertical" aria-valuemin={224} aria-valuemax={400} aria-valuenow={ui.width} tabIndex={0}
        onPointerDown={event => { event.preventDefault(); resize.current = { x: event.clientX, width: ui.width }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (resize.current) setUI(previous => ({ ...previous, width: Math.max(224, Math.min(400, resize.current.width + event.clientX - resize.current.x)) })); }}
        onPointerUp={event => { resize.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { if (resize.current) { const width = resize.current.width; setUI(previous => ({ ...previous, width })); } resize.current = null; }}
        onDoubleClick={() => setUI(previous => ({ ...previous, width: 256 }))}
        onKeyDown={event => { if (event.key === 'Escape' && resize.current) { const width = resize.current.width; resize.current = null; setUI(previous => ({ ...previous, width })); } if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setUI(previous => ({ ...previous, width: Math.max(224, Math.min(400, previous.width + (event.key === 'ArrowRight' ? 8 : -8))) })); } }}/>}</aside>
    <main className="bkm-main" aria-label="收藏管理" inert={compact && sidebarOpen ? true : undefined}>
      <header className="bkm-topbar">
        {!sidebarOpen && <button className="bkm-icon" aria-label="展开目录" onClick={() => setSidebarOpen(true)}><SidebarToggleIcon size={18} expanded={false}/></button>}
        <nav className="bkm-breadcrumbs" aria-label="收藏路径">
          {path.length > 3 && <button aria-label="查看完整路径" onClick={event => showMenu(event, '上级文件夹', path.slice(0, -2).map(node => ({ label: node.title, icon: Folder, action: () => navigate(node.id) })))}>…</button>}
          {(path.length > 3 ? path.slice(-2) : path).map((node, index) => <span className="bkm-breadcrumb-part" key={node.id}>
            {(index > 0 || path.length > 3) && <ChevronRight size={14}/>}
            {node.id === location ? <><h2 aria-current="page" title={node.title}>{node.title}</h2><span className="bkm-location-count">{rows.length} 项</span></> : <button title={node.title} onClick={() => navigate(node.id)} {...dropProps(node.id, 'breadcrumb')}>{node.title}</button>}
          </span>)}
          <BookmarkHelp/>
        </nav>
        <div className="bkm-topbar-actions" role="group" aria-label="收藏工具栏">
          {searchOpen ? <div className="bkm-heading-search bkm-search"><Search size={16}/><input ref={searchRef} aria-label="搜索收藏" placeholder="搜索收藏、网址与备注" value={query} onChange={event => { setQuery(event.target.value); setSelection([]); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }}/><button className="bkm-icon" aria-label={query ? '清空搜索' : '关闭搜索'} onClick={() => { if (query) { setQuery(''); searchRef.current?.focus(); } else closeSearch(); }}><X size={12}/></button></div>
            : <button ref={searchToggleRef} className="bkm-icon" aria-label="搜索收藏" title="搜索收藏" onClick={() => setSearchOpen(true)}><Search size={17}/></button>}
          <div className="bkm-view-switch" role="group" aria-label="显示方式">
            <button className="bkm-icon" aria-label="列表视图" title="列表视图" aria-pressed={ui.view === 'list'} onClick={() => changeView('list')}><List size={18}/></button>
            <button className="bkm-icon" aria-label="分栏视图" title="分栏视图" aria-pressed={ui.view === 'columns'} onClick={() => changeView('columns')}><Columns3 size={18}/></button>
          </div>
          <button className="bkm-button bkm-new-folder" aria-label="新建文件夹" title="新建文件夹" onClick={() => createAction('folder')}><FolderPlus size={16}/><span>新建文件夹</span></button>
          <button className="bkm-button bkm-transfer" aria-label="导入收藏" title="导入收藏" onClick={() => importRef.current.click()}><Import size={16}/><span>导入</span></button>
          <button className="bkm-button bkm-transfer" aria-label="导出收藏" title="导出收藏" aria-haspopup="menu" onClick={exportMenu}><Download size={16}/><span>导出</span></button>
          <button className={`bkm-icon${kind !== 'all' ? ' is-active' : ''}`} aria-label="收藏更多操作" title="更多操作" onClick={libraryMenu}><Ellipsis size={18}/></button>
        </div>
      </header>
      {storageError && <div className="bkm-storage-error" role="alert">{storageError}</div>}
      {(query || kind !== 'all') && <div className="bkm-search-summary"><span>{query ? `“${query}” · ${rows.length} 个结果${ui.view === 'columns' ? ' · 以列表展示' : ''}` : kind === 'folder' ? '仅显示文件夹' : '仅显示网页收藏'}</span>
        {query && <button className="bkm-text-button" onClick={event => showMenu(event, '搜索范围', [{ label: '当前目录及子目录', checked: scope === 'current', action: () => { setScope('current'); setSelection([]); } }, { label: '所有目录', checked: scope === 'all', action: () => { setScope('all'); setSelection([]); } }])}>{scope === 'all' ? '所有目录' : '当前目录及子目录'}<ChevronRight size={12}/></button>}
        <button className="bkm-text-button" onClick={() => { setQuery(''); setKind('all'); }}>清除筛选</button>
      </div>}
      <div className={`bkm-list-scroll${isColumns ? ' is-columns' : ''}`} ref={listRef} tabIndex={0} aria-label="收藏内容列表" onContextMenu={backgroundMenu} {...(!isColumns ? marqueeHandlers : {})}>
        {isColumns ? <BookmarkColumns onToggleColumn={toggleColumn} groups={groups} selected={selected} selectedNodes={selectedNodes} counts={directCounts} clipboard={clipboard} rowProps={rowProps} marquee={marquee} dragging={dragging} marqueeHandlers={marqueeHandlers} createAction={createAction} openNode={openNode} onEdit={node => setDialog({ type: 'edit', node })}/>
          : <div className="bkm-list-content">
            <div role="grid" aria-label="收藏条目" aria-multiselectable="true">
              <div className="bkm-list-head" role="row">
                <div role="gridcell"><input type="checkbox" aria-label={allSelected ? '取消全选' : '全选当前结果'} checked={allSelected} ref={element => { if (element) element.indeterminate = selection.length > 0 && !allSelected; }} disabled={!rows.length} onChange={toggleAll}/></div>
                <span role="columnheader">名称</span><span role="columnheader">地址</span><span/>
              </div>
              <div role="rowgroup">{rows.map((node, index) => <BookmarkRow key={node.id} node={node} index={index} siblings={rows} count={directCounts[node.id] || 0} selected={selected.has(node.id)} cut={clipboard?.mode === 'cut' && clipboard.ids.includes(node.id)} {...rowProps}/>)}</div>
            </div>
            {!rows.length && <div className="bkm-empty">{query ? <Search size={32} strokeWidth={1.25}/> : <Folder size={34} strokeWidth={1.25}/>}<h3>{query ? '没有找到相关收藏' : kind !== 'all' ? '没有这类内容' : '这个文件夹还没有内容'}</h3><p>{query ? '试试名称、网址、收藏理由或摘录中的关键词。' : '添加收藏，或把已有内容移动到这里。'}</p>{query || kind !== 'all' ? <button className="bkm-button" onClick={() => { setQuery(''); setKind('all'); }}>清除筛选</button> : <button className="bkm-button" onClick={() => createAction()}>添加收藏</button>}</div>}
            {marquee && <div className="bkm-marquee" style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}/>}
          </div>}
      </div>
      {!!selection.length && <BookmarkBatchToolbar>
        <span className="bkm-batch-count">已选 {selection.length} 项</span>
        <button title="移动到文件夹" aria-label="移动到" onClick={() => moveAction(selection)}><FolderInput size={16}/><span>移动到</span></button>
        <button className="bkm-batch-group" title="放入新文件夹" aria-label="放入新文件夹" onClick={() => groupAction(selection)}><FolderPlus size={16}/><span>新建并移入</span></button>
        <button title="复制链接" aria-label="复制链接" disabled={!collectedLinks(library, selection).length} onClick={() => copyLinks(selection)}><Copy size={15}/></button>
        <button className="bkm-batch-delete" title="删除" aria-label="删除所选" onClick={() => deleteAction(selection)}><Trash2 size={16}/></button>
        <button title="撤销" aria-label="撤销整理" disabled={!undoCount} onClick={doUndo}><Undo2 size={15}/></button>
        <button title="更多操作" aria-label="更多批量操作" onClick={event => itemMenu(event, selection, selectedNodes[0])}><Ellipsis size={17}/></button>
        <button className="board-batch-done" onClick={() => setSelection([])}><Check size={15}/><span>完成</span></button>
      </BookmarkBatchToolbar>}

    </main>
    <input ref={importRef} hidden type="file" accept=".html,.htm,.json" onChange={importFile}/>
    {menu && <BookmarkMenu key={`${menu.x}-${menu.y}-${menu.label}`} menu={menu} onClose={closeMenu}/>}
    {dialog && ['edit', 'group'].includes(dialog.type) && <BookmarkEditDialog action={dialog} library={library} onClose={() => setDialog(null)} onSubmit={fields => {
      perform(dialog.type === 'group' ? { type: 'group', ids: dialog.ids, parentId: dialog.parentId, ...fields } : dialog.node ? { type: 'edit', id: dialog.node.id, ...fields } : { type: 'create', kind: dialog.kind, parentId: dialog.parentId, ...fields }, dialog.type === 'group' ? '已创建文件夹并移动所选内容' : dialog.node ? '已保存修改' : dialog.kind === 'folder' ? '已新建文件夹' : '已添加收藏'); setDialog(null);
    }}/>}
    {dialog?.type === 'move' && <BookmarkMoveDialog action={dialog} library={library} recentFolders={ui.recentFolders} onClose={() => setDialog(null)} onMove={target => { move(dialog.ids, target); setDialog(null); }} onCreate={fields => perform({ type: 'create', kind: 'folder', ...fields }, '已新建目标文件夹')}/>}
    {dialog?.type === 'confirm' && <BookmarkConfirmDialog action={dialog} onClose={() => setDialog(null)} onConfirm={() => { dialog.execute(); setDialog(null); }}/>}
    {dialog?.type === 'text' && <BookmarkTextDialog title={dialog.title} value={dialog.value} onClose={() => setDialog(null)}/>}
    {notice && <div className={`bkm-toast${notice.error ? ' is-error' : ''}`} role={notice.error ? 'alert' : 'status'}><span>{notice.message}</span>{!notice.error && undoCount > 0 && <button onClick={doUndo}>撤销</button>}<button className="bkm-icon" aria-label="关闭提示" onClick={() => setNotice(null)}><X size={14}/></button></div>}
  </div>;
}
