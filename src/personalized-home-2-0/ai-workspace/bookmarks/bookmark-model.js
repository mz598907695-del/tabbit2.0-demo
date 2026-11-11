export const BOOKMARKS_KEY = 'tabbit.bookmarks.v2';
export const BOOKMARK_UI_KEY = 'tabbit.bookmarks.ui.v2';
export const SMART_VIEWS = ['all', 'later', 'recent', 'trash'];
export const makeId = () => `bm-${globalThis.crypto.randomUUID()}`;
export const ordered = nodes => [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
export const liveNodes = library => library.nodes.filter(node => !node.deletedAt);

export function ensureBookmarkRoots(library) {
  const nodes = library.nodes.map(node => ({ ...node })), rootIds = {};
  for (const [key, title] of [['toolbar', '导航栏'], ['folders', '收藏夹']]) {
    let root = nodes.find(node => node.kind === 'folder' && !node.deletedAt && !node.parentId && (node.systemRoot === key || node.id === library.rootIds?.[key]))
      || nodes.find(node => node.kind === 'folder' && !node.deletedAt && !node.parentId && node.title === title && !node.systemRoot);
    if (!root) {
      let id = `bm-root-${key}`, suffix = 1;
      while (nodes.some(node => node.id === id)) id = `bm-root-${key}-${suffix++}`;
      root = { id, kind: 'folder', parentId: null, createdAt: 0 }; nodes.push(root);
    }
    Object.assign(root, { title, systemRoot: key, order: key === 'toolbar' ? 0 : 1 }); rootIds[key] = root.id;
  }
  nodes.forEach(node => { if (!node.parentId && !node.deletedAt && !Object.values(rootIds).includes(node.id)) node.parentId = rootIds.folders; });
  return { ...library, nodes, rootIds };
}

export function safeBookmarkUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

export function migrateBookmarks(bookmarks = []) {
  const nodes = [], folders = new Map();
  for (const [index, item] of bookmarks.entries()) {
    const category = item.type || '';
    if (category && !folders.has(category)) {
      const id = `bm-legacy-folder-${encodeURIComponent(category)}`;
      folders.set(category, id);
      nodes.push({ id, kind: 'folder', title: category, parentId: null, order: folders.size - 1, createdAt: 0 });
    }
    nodes.push({ ...item, id: item.id || `bm-legacy-${index}`, kind: 'bookmark', parentId: folders.get(category) || null,
      url: safeBookmarkUrl(item.url || (item.domain ? `https://${item.domain}` : '')), order: index, createdAt: item.createdAt || 0 });
  }
  return { version: 2, revision: 'migration', nodes };
}

export function parseBookmarkLibrary(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || value.version !== 2 || !Array.isArray(value.nodes)) throw new Error('无法识别收藏文件。');
  const ids = new Set();
  for (const node of value.nodes) {
    if (!node || typeof node.id !== 'string' || ids.has(node.id) || !['folder', 'bookmark'].includes(node.kind) || typeof node.title !== 'string') throw new Error('收藏数据不完整或存在重复编号。');
    ids.add(node.id);
  }
  const byId = new Map(value.nodes.map(node => [node.id, node]));
  for (const node of value.nodes) {
    const seen = new Set([node.id]); let parent = node.parentId;
    while (parent) {
      const folder = byId.get(parent);
      if (!folder || folder.kind !== 'folder' || seen.has(parent)) throw new Error('收藏目录存在无效层级。');
      if (!node.deletedAt && folder.deletedAt) throw new Error('收藏目录已被删除。');
      seen.add(parent); parent = folder.parentId;
    }
  }
  return { ...value, nodes: value.nodes.map(node => ({ ...node, parentId: node.parentId || null, ...(node.kind === 'bookmark' ? { url: safeBookmarkUrl(node.url) } : {}) })) };
}

export function folderPath(nodes, id) {
  const byId = new Map(nodes.map(node => [node.id, node])), path = [], seen = new Set();
  while (id && byId.has(id) && !seen.has(id)) {
    seen.add(id); const node = byId.get(id); path.unshift(node); id = node.parentId;
  }
  return path;
}

export function descendantIds(nodes, ids) {
  const found = new Set(ids), children = new Map();
  nodes.forEach(node => { const list = children.get(node.parentId) || []; list.push(node.id); children.set(node.parentId, list); });
  const pending = [...ids];
  while (pending.length) for (const child of children.get(pending.pop()) || []) if (!found.has(child)) { found.add(child); pending.push(child); }
  return found;
}

export function selectionRoots(nodes, ids) {
  const selected = new Set(ids);
  return ordered(nodes).filter(node => selected.has(node.id) && !folderPath(nodes, node.parentId).some(parent => selected.has(parent.id)));
}

export function canMoveTo(library, ids, parentId) {
  const nodes = liveNodes(library);
  if (parentId && !nodes.some(node => node.id === parentId && node.kind === 'folder')) return false;
  const roots = selectionRoots(nodes, ids);
  return roots.length > 0 && roots.every(node => !node.systemRoot) && !descendantIds(nodes, roots.map(node => node.id)).has(parentId);
}

function checkDestination(library, parentId) {
  if (parentId && !liveNodes(library).some(node => node.id === parentId && node.kind === 'folder')) throw new Error('目标文件夹已不存在，请重新选择。');
}

export function viewBookmarks(library, { location = 'root', query = '', scope = 'current', sort = 'manual', kind = 'all' } = {}) {
  const live = liveNodes(library), search = query.trim().toLocaleLowerCase();
  let nodes;
  if (location === 'trash') nodes = library.nodes.filter(node => node.deletedAt && node.trashRoot === node.id);
  else if (location === 'all') nodes = live.filter(node => node.kind === 'bookmark');
  else if (location === 'later') nodes = live.filter(node => node.kind === 'bookmark' && node.later);
  else if (location === 'recent') nodes = live.filter(node => node.kind === 'bookmark' && node.openedAt);
  else {
    const parentId = location === 'root' ? null : location;
    const within = descendantIds(live, [parentId]);
    nodes = search ? live.filter(node => scope === 'all' || (node.id !== parentId && within.has(node.id))) : live.filter(node => node.parentId === parentId);
  }
  if (kind !== 'all') nodes = nodes.filter(node => node.kind === kind);
  if (search) nodes = nodes.filter(node => !node.systemRoot && `${node.title} ${node.url || ''} ${node.description || ''} ${node.note || ''} ${node.excerpt || ''}`.toLocaleLowerCase().includes(search));
  return [...nodes].sort((a, b) => location === 'trash' ? b.deletedAt - a.deletedAt : location === 'recent' ? b.openedAt - a.openedAt
    : sort === 'name' ? a.title.localeCompare(b.title, 'zh-CN', { numeric: true })
    : sort === 'recent' ? (b.createdAt || 0) - (a.createdAt || 0) : sort === 'oldest' ? (a.createdAt || 0) - (b.createdAt || 0) : (a.order || 0) - (b.order || 0));
}

export function collectedLinks(library, ids) {
  const nodes = liveNodes(library), all = descendantIds(nodes, ids);
  return ordered(nodes).filter(node => all.has(node.id) && node.kind === 'bookmark');
}

export function bookmarkCommand(library, command, { now = Date.now(), id = makeId } = {}) {
  if (library.rootIds && ['create', 'move', 'group', 'copy', 'import'].includes(command.type)) command = { ...command, parentId: command.parentId || library.rootIds.folders };
  const next = { ...library, nodes: library.nodes.map(node => ({ ...node })) };
  const nodes = next.nodes, live = liveNodes(next), ids = command.ids || [];
  const roots = selectionRoots(live, ids), selected = new Set(roots.map(node => node.id));
  const lastOrder = parentId => Math.max(-1, ...nodes.filter(node => !node.deletedAt && node.parentId === parentId).map(node => node.order || 0)) + 1;
  switch (command.type) {
    case 'create': {
      checkDestination(next, command.parentId);
      const title = command.title.trim();
      if (!title) throw new Error('请填写名称。');
      const url = safeBookmarkUrl(command.url);
      if (command.kind === 'bookmark' && !url) throw new Error('请输入完整的 HTTP 或 HTTPS 网页地址。');
      nodes.push({ id: command.id || id(), kind: command.kind, title, parentId: command.parentId || null, order: lastOrder(command.parentId || null), createdAt: now,
        ...(command.kind === 'bookmark' ? { url, note: command.note || '', excerpt: command.excerpt || '', later: !!command.later } : {}) });
      break;
    }
    case 'edit': {
      const node = live.find(node => node.id === command.id);
      if (!node) throw new Error('这条收藏已不存在。');
      if (node.systemRoot) throw new Error('根目录不能重命名。');
      if (!command.title.trim()) throw new Error('请填写名称。');
      if (node.kind === 'bookmark' && !safeBookmarkUrl(command.url)) throw new Error('请输入完整的 HTTP 或 HTTPS 网页地址。');
      Object.assign(node, { title: command.title.trim(), updatedAt: now }, node.kind === 'bookmark' ? { url: safeBookmarkUrl(command.url), note: command.note || '', excerpt: command.excerpt || '', later: !!command.later } : {});
      break;
    }
    case 'move':
    case 'group': {
      if (!canMoveTo(next, ids, command.parentId || null)) throw new Error('不能移动到自身、子文件夹或不存在的目录。');
      let destination = command.parentId || null;
      if (command.type === 'group') {
        if (!command.title?.trim()) throw new Error('请填写文件夹名称。');
        destination = command.id || id();
        nodes.push({ id: destination, kind: 'folder', title: command.title.trim(), parentId: command.parentId || null, createdAt: now, order: lastOrder(command.parentId || null) });
      }
      const siblings = ordered(nodes.filter(node => !node.deletedAt && node.parentId === destination && !selected.has(node.id)));
      let at = command.beforeId ? siblings.findIndex(node => node.id === command.beforeId) : siblings.length;
      if (at < 0) throw new Error('排序位置已改变，请重试。');
      if (command.afterId) { at = siblings.findIndex(node => node.id === command.afterId); if (at < 0) throw new Error('排序位置已改变，请重试。'); at += 1; }
      roots.forEach(node => { node.parentId = destination; });
      siblings.splice(at, 0, ...roots);
      siblings.forEach((node, order) => { node.order = order; });
      break;
    }
    case 'delete': {
      if (roots.some(node => node.systemRoot)) throw new Error('根目录不能删除。');
      for (const root of roots) {
        const subtree = descendantIds(live, [root.id]);
        live.forEach(node => { if (subtree.has(node.id)) Object.assign(node, { deletedAt: now, trashRoot: root.id }); });
      }
      break;
    }
    case 'restore': {
      const trashRoots = nodes.filter(node => node.deletedAt && node.trashRoot === node.id && ids.includes(node.id));
      const restoring = new Set(nodes.filter(node => trashRoots.some(root => root.id === node.trashRoot)).map(node => node.id));
      for (const root of trashRoots) {
        if (root.parentId && !nodes.some(node => node.id === root.parentId && (!node.deletedAt || restoring.has(node.id)))) root.parentId = null;
        root.order = lastOrder(root.parentId);
      }
      nodes.forEach(node => { if (restoring.has(node.id)) { delete node.deletedAt; delete node.trashRoot; } });
      break;
    }
    case 'purge': {
      const removing = new Set(nodes.filter(node => node.deletedAt && ids.includes(node.trashRoot)).map(node => node.id));
      next.nodes = nodes.filter(node => !removing.has(node.id)).map(node => removing.has(node.parentId) ? { ...node, parentId: null } : node);
      break;
    }
    case 'later':
      nodes.forEach(node => { if (!node.deletedAt && ids.includes(node.id) && node.kind === 'bookmark') node.later = command.value; });
      break;
    case 'visit':
      nodes.forEach(node => { if (!node.deletedAt && ids.includes(node.id) && node.kind === 'bookmark') node.openedAt = now; });
      break;
    case 'copy':
    case 'import': {
      checkDestination(next, command.parentId);
      const source = command.nodes || [];
      parseBookmarkLibrary({ version: 2, nodes: source });
      const mapping = new Map(source.map(node => [node.id, id()])), roots = ordered(source.filter(node => !mapping.has(node.parentId)));
      const start = lastOrder(command.parentId || null);
      for (const node of source) {
        const rootIndex = roots.findIndex(root => root.id === node.id);
        const copied = { ...node, id: mapping.get(node.id), parentId: mapping.get(node.parentId) || command.parentId || null,
          order: rootIndex >= 0 ? start + rootIndex : node.order, createdAt: command.type === 'copy' ? now : node.createdAt || now };
        delete copied.deletedAt; delete copied.trashRoot; delete copied.openedAt;
        delete copied.systemRoot;
        nodes.push(copied);
      }
      break;
    }
    default: throw new Error('不支持的收藏操作。');
  }
  return next;
}

export function copyBookmarkNodes(library, ids) {
  const live = liveNodes(library), roots = selectionRoots(live, ids), selected = descendantIds(live, roots.map(node => node.id));
  return live.filter(node => selected.has(node.id)).map(node => ({ ...node, parentId: selected.has(node.parentId) ? node.parentId : null }));
}

// The standalone manager owns the canonical library. The workspace reads a
// compatibility projection so an unrelated workspace write cannot restore trash.
export function projectWorkspaceBookmarks(data, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(BOOKMARKS_KEY);
    if (!raw) return data;
    const library = parseBookmarkLibrary(raw);
    return { ...data, bookmarks: liveNodes(library).filter(node => node.kind === 'bookmark').map(node => ({ ...node,
      type: folderPath(library.nodes, node.parentId).find(parent => !parent.systemRoot)?.title || '未分类',
      description: node.note || node.description || '', domain: safeBookmarkUrl(node.url) ? new URL(node.url).hostname : '',
    })) };
  } catch { return data; }
}
