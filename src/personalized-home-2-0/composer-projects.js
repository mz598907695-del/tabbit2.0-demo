export const MAX_PROJECT_NAME_LENGTH = 64;

export function validateProjectName(projects, name, excludedId = null) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { ok: false, message: '请输入项目名称。' };
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) return { ok: false, message: '项目名称最多 64 个字符。' };
  const normalized = trimmed.toLocaleLowerCase();
  const duplicate = projects.some(project =>
    (excludedId == null || project.id !== excludedId) && project.name.trim().toLocaleLowerCase() === normalized);
  if (duplicate) return { ok: false, message: '已有同名项目，请换一个名称。' };
  return { ok: true, name: trimmed };
}

export function promoteProject(projects, id) {
  if (id == null) return projects;
  const index = projects.findIndex(project => project.id === id);
  if (index <= 0) return projects;
  return [projects[index], ...projects.slice(0, index), ...projects.slice(index + 1)];
}
