import { useEffect, useRef, useState } from 'react';
import { supplementBookmarkDemo } from './bookmark-demo';
import { readWorkspaceData } from '../workspace-data';
import { BOOKMARKS_KEY, bookmarkCommand, ensureBookmarkRoots, makeId, migrateBookmarks, parseBookmarkLibrary } from './bookmark-model';

function initialLibrary() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (raw) return { library: supplementBookmarkDemo(ensureBookmarkRoots(parseBookmarkLibrary(raw))), error: '' };
    return { library: supplementBookmarkDemo(ensureBookmarkRoots(migrateBookmarks(readWorkspaceData().bookmarks))), error: '' };
  } catch { return { library: supplementBookmarkDemo(ensureBookmarkRoots(migrateBookmarks(readWorkspaceData().bookmarks))), error: '收藏存储暂不可用，已保留原数据。请刷新后重试。' }; }
}

export default function useBookmarkLibrary() {
  const [initial] = useState(initialLibrary);
  const [library, setLibrary] = useState(initial.library);
  const [storageError, setStorageError] = useState(initial.error);
  const [undoCount, setUndoCount] = useState(0);
  const history = useRef([]), current = useRef(library);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      const next = raw ? supplementBookmarkDemo(ensureBookmarkRoots(parseBookmarkLibrary(raw))) : initial.library;
      if (raw !== JSON.stringify(next)) localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      current.current = next; setLibrary(next);
    }
    catch { setStorageError('无法保存收藏，请检查浏览器存储空间后刷新重试。'); }
    const sync = event => {
      if (event.key !== BOOKMARKS_KEY) return;
      try {
        const next = ensureBookmarkRoots(parseBookmarkLibrary(event.newValue));
        current.current = next; setLibrary(next); history.current = []; setUndoCount(0); setStorageError('');
      } catch { setStorageError('另一标签页的收藏数据无法读取，当前内容已保留。请刷新后重试。'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [initial]);

  function latest() {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) throw new Error('收藏存储已改变，请刷新后重试。');
    return ensureBookmarkRoots(parseBookmarkLibrary(raw));
  }
  function save(next) {
    next = { ...next, revision: makeId() };
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    current.current = next; setLibrary(next); setStorageError('');
    return next;
  }
  function commit(command, label, { undoable = true } = {}) {
    if (storageError) throw new Error(storageError);
    const before = latest();
    const next = bookmarkCommand(before, command);
    if (JSON.stringify(before.nodes) === JSON.stringify(next.nodes)) return false;
    const expectedRevision = history.current.at(-1)?.afterRevision || current.current.revision;
    const saved = save(next);
    if (before.revision !== expectedRevision) history.current = [];
    if (undoable) history.current = [...history.current.slice(-29), { before, afterRevision: saved.revision, label }];
    else if (command.type === 'visit') {
      // Opening a link should not discard the user's previous organizing work.
      const visited = new Map(saved.nodes.filter(node => command.ids.includes(node.id)).map(node => [node.id, node.openedAt]));
      history.current = history.current.map(entry => ({ ...entry, before: { ...entry.before, nodes: entry.before.nodes.map(node => visited.has(node.id) ? { ...node, openedAt: visited.get(node.id) } : node) } }));
      if (history.current.length) history.current.at(-1).afterRevision = saved.revision;
    } else { history.current = []; }
    setUndoCount(history.current.length);
    return true;
  }
  function undo() {
    const last = history.current.at(-1);
    if (!last) return '';
    const latestValue = latest();
    if (latestValue.revision !== last.afterRevision) { history.current = []; setUndoCount(0); throw new Error('收藏已在其他标签页更新，请检查最新内容。'); }
    const saved = save(last.before);
    history.current.pop();
    if (history.current.length) history.current.at(-1).afterRevision = saved.revision;
    setUndoCount(history.current.length);
    return last.label;
  }
  return { library, commit, undo, undoCount, storageError };
}
