const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Resolve deferred widget changes against the latest page, not a render snapshot. */
export function applyBoardPageChange(pages, update, pageId) {
  const targetId = typeof update === 'function' ? pageId : update?.id;
  const index = pages.findIndex(page => page.id === targetId);
  if (index < 0) return pages;
  const current = pages[index];
  const next = typeof update === 'function' ? update(current) : update;
  if (!record(next) || next.id !== current.id || next === current) return pages;
  const result = [...pages];
  result[index] = next;
  return result;
}

export function patchBoardWidgetConfig(page, itemId, patch) {
  if (!record(patch)) return page;
  const index = page.items.findIndex(item => item.id === itemId && item.type === 'widget');
  if (index < 0) return page;
  const item = page.items[index], config = record(item.config) ? item.config : {};
  if (Object.entries(patch).every(([key, value]) => Object.is(config[key], value))) return page;
  const items = [...page.items];
  items[index] = { ...item, config: { ...config, ...patch } };
  return { ...page, items };
}
