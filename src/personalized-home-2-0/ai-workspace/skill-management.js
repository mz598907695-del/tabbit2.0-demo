export function duplicateSkill(item, id, now = Date.now()) {
  const copy = structuredClone(item);
  for (const key of ['publication', 'versions', 'history', 'publicationId', 'sourceId', '_publicView', 'publicView', 'deleted']) delete copy[key];
  return { ...copy, id, title: `${item.title} 副本`, type: 'custom', author: '我', installed: false, enabled: true,
    version: '1.0', installCount: 0, createdAt: now, updatedAt: new Date(now).toISOString().slice(0, 10) };
}

export function saveSkillDraft(form, existing, id, now = Date.now()) {
  return { ...existing, ...form, id: existing?.id || id, type: 'custom', author: existing?.author || '我',
    enabled: existing?.enabled ?? true, installed: false, installCount: existing?.installCount ?? 0,
    createdAt: existing?.createdAt || now, updatedAt: new Date(now).toISOString().slice(0, 10),
    version: existing?.version || '1.0', publication: existing?.publication, versions: existing?.versions };
}
