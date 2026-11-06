// Present one library without rewriting either persisted collection. Namespaced
// IDs keep legacy file/asset records distinct, even when their original IDs match.
export function getWorkspaceOutputs(data) {
  const groups = ['files', 'assets'].map(collection => (data[collection] || []).map(item => ({
    ...item,
    id: `${collection}:${item.id}`,
    type: item.type === 'home' ? 'board' : item.type,
    _outputSource: { collection, id: item.id, type: item.type },
  })));
  // Preserve each source's saved order; do not parse localized display dates.
  return Array.from({ length: Math.max(...groups.map(group => group.length)) }, (_, index) => groups.map(group => group[index]))
    .flat().filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getWorkspaceItems(data, page) {
  return page === 'files' ? getWorkspaceOutputs(data) : data[page] || [];
}

export function resolveWorkspaceRoute(page, filter, data) {
  if (page !== 'assets' && page !== 'files') return { page, filter };
  const items = getWorkspaceOutputs(data);
  const collection = page;
  const found = items.find(item => filter === `detail:${item.id}`) || items.find(item => (
    item._outputSource.collection === collection && (filter === `detail:${item._outputSource.id}` || filter === item.title)
  ));
  if (found) return { page: 'files', filter: `detail:${found.id}` };
  if (page === 'assets' && filter === 'create') return { page: 'files', filter: 'create:board' };
  return { page: 'files', filter: filter === 'home' || filter === '首页' || filter === '看板' ? 'board' : filter };
}

export function updateWorkspaceOutput(data, output) {
  const { _outputSource: source, ...item } = output;
  if (!source) return data;
  return { ...data, [source.collection]: data[source.collection].map(existing => existing.id === source.id
    ? { ...item, id: source.id, type: source.type } : existing) };
}

export function outputCollection(type) {
  return type === 'card' || type === 'board' ? 'assets' : 'files';
}
