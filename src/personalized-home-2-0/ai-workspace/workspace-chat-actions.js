import { findFileSource } from './file-actions.js';

export function updateWorkspaceChat(data, id, patch = {}) {
  const chat = data.chats.find(item => item.id === id);
  if (!chat) return data;

  const changes = {};
  const title = typeof patch?.title === 'string' ? patch.title.trim() : '';
  if (title && title !== chat.title) changes.title = title;
  if (typeof patch?.pinned === 'boolean' && patch.pinned !== chat.pinned) changes.pinned = patch.pinned;
  if (!Object.keys(changes).length) return data;

  const result = { ...data, chats: data.chats.map(item => item.id === id ? { ...item, ...changes } : item) };
  if (changes.title) {
    // Legacy outputs link by title. Resolve before renaming and give matched
    // records a stable ID so subsequent renames do not lose the conversation.
    for (const collection of ['files', 'assets']) {
      const records = data[collection];
      if (!Array.isArray(records)) continue;
      let changed = false;
      const updated = records.map(item => {
        if (findFileSource(item, data.chats)?.id !== id) return item;
        changed = true;
        return { ...item, sourceId: id, source: title };
      });
      if (changed) result[collection] = updated;
    }
  }
  return result;
}

export function deleteWorkspaceChats(data, ids = []) {
  const selected = new Set(ids);
  const chats = data.chats.filter(item => !selected.has(item.id));
  if (chats.length === data.chats.length) return data;
  const result = { ...data, chats };
  // Retain output metadata, but do not let title fallback redirect a deleted
  // source to a different conversation that happens to have the same name.
  for (const collection of ['files', 'assets']) {
    const records = data[collection];
    if (!Array.isArray(records)) continue;
    let changed = false;
    const updated = records.map(item => {
      const source = findFileSource(item, data.chats);
      if (!source || !selected.has(source.id)) return item;
      changed = true;
      return { ...item, sourceDeleted: true };
    });
    if (changed) result[collection] = updated;
  }
  return result;
}

// Pinned conversations stay available; source tabs filter the recent list only.
export function getSidebarChats(chats, source = 'cloud') {
  return chats.filter(chat => chat.pinned || chat.type === source);
}
