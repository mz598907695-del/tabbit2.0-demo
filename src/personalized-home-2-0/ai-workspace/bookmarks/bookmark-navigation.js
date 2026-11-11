import { folderPath, liveNodes, viewBookmarks } from './bookmark-model.js';

export function bookmarkPresentation(saved, rootIds) {
  const current = saved?.layoutVersion === 3;
  return { layoutVersion: 3, toolbarIconsOnly: saved?.toolbarIconsOnly === true,
    location: current && typeof saved.location === 'string' ? saved.location : rootIds.toolbar,
    expanded: [...new Set([...(Array.isArray(saved?.expanded) ? saved.expanded : []), ...(!current ? [rootIds.toolbar] : [])])],
    width: Math.max(224, Math.min(400, Number(saved?.width) || 256)),
    sorts: saved?.sorts || {}, recentFolders: saved?.recentFolders || [], view: saved?.view === 'columns' ? 'columns' : 'list' };
}

export function bookmarkColumnGroups(library, location, sorts = {}, kind = 'all') {
  const live = liveNodes(library);
  return folderPath(live, location).filter(node => node.kind === 'folder').map(folder => ({ folder,
    rows: viewBookmarks(library, { location: folder.id, sort: sorts[folder.id] || 'manual', kind }) }));
}
