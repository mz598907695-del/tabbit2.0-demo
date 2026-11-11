// AI Card Package v1 / runtime API v2. This local host intentionally supports
// self-contained cards; connected data sources require the production host.
export const AI_CARD_MAX_BYTES = 8_000_000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bytes = value => new TextEncoder().encode(value).length;
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function fields(value, allowed, label) {
  requireValue(record(value), `${label}必须是对象`);
  requireValue(Object.keys(value).every(key => allowed.includes(key)), `${label}包含不支持的字段`);
}
export function validateAICardPackage(value) {
  fields(value, ['schemaVersion', 'kind', 'artifact', 'catalog'], '文件');
  requireValue(value.schemaVersion === 1 && value.kind === 'ai-card', '请选择 AI Card 格式的 JSON 文件（schemaVersion 1）');
  const { artifact: a, catalog: c } = value;
  fields(a, ['version','runtimeApiVersion','renderer','manifest','sourceCode','previewData'], 'artifact');
  requireValue(a.runtimeApiVersion === 2 && a.renderer === 'web-component', '此卡片运行版本不受支持，需要 runtime API 2 / web-component');
  requireValue(typeof a.version === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(a.version), '卡片版本号无效');
  requireValue(typeof a.sourceCode === 'string' && a.sourceCode.trim() && !a.sourceCode.includes('\0') && bytes(a.sourceCode) <= 2_000_000, '卡片源码为空或超过 2 MB');
  requireValue(/export\s+default\s+class\s*(?:[A-Za-z_$][\w$]*\s+)?extends\s+HTMLElement\b/.test(a.sourceCode), '卡片需导出 HTMLElement 组件');
  const m = a.manifest;
  fields(m, ['surfaces','catalog','configSchema','permissions','storage'], 'manifest');
  fields(m.surfaces, ['card','modal'], 'surfaces');
  for (const surface of Object.values(m.surfaces)) {
    fields(surface, ['renderer'], 'surface');
    requireValue(surface.renderer === 'web-component', '卡片渲染方式不受支持');
  }
  requireValue(m.surfaces.card?.renderer === 'web-component', '缺少 card 展示面');
  if (m.catalog !== undefined) {
    fields(m.catalog, ['defaultSize','supportedSizes','defaultConfig','defaultDataSource'], 'manifest.catalog');
    const { defaultSize, supportedSizes, defaultConfig, defaultDataSource } = m.catalog;
    requireValue(!defaultDataSource, '此卡片依赖在线数据源，请在 Tabbit 在线首页中导入');
    if (defaultSize !== undefined || supportedSizes !== undefined) {
      requireValue(typeof defaultSize === 'string' && /^[1-9]\d*x[1-9]\d*$/.test(defaultSize) && defaultSize.length <= 32, '卡片默认尺寸无效');
      requireValue(Array.isArray(supportedSizes) && supportedSizes.includes(defaultSize) && supportedSizes.every(s => typeof s === 'string' && s.length <= 32 && /^[1-9]\d*x[1-9]\d*$/.test(s)), '卡片支持尺寸无效');
    }
    requireValue(defaultConfig === undefined || record(defaultConfig), '默认配置必须是对象');
  }
  const permissions = m.permissions?.bridge || [];
  if (m.permissions !== undefined) fields(m.permissions, ['bridge','dataSources'], 'permissions');
  requireValue(Array.isArray(permissions) && new Set(permissions).size === permissions.length && permissions.every(p => ['openModal','closeModal','storage','fetchData'].includes(p)), '卡片权限声明无效');
  requireValue(!permissions.includes('fetchData') && !(m.permissions?.dataSources?.length), '此卡片需要在线数据源，当前本地预览支持离线 AI 卡片');
  requireValue(!permissions.some(p => ['openModal','closeModal'].includes(p)) || m.surfaces.modal, '详情权限需要声明 modal 展示面');
  requireValue(permissions.includes('storage') === (m.storage?.schemaVersion === 1), '卡片存储权限声明不完整');
  if (m.storage !== undefined) fields(m.storage, ['schemaVersion'], 'storage');
  fields(c, ['title','description','category','tags','icon'], 'catalog');
  requireValue(typeof c.title === 'string' && c.title.trim() && c.title.length <= 256, '请为卡片填写有效名称');
  requireValue(typeof c.description === 'string' && c.description.length <= 1024, '卡片描述无效');
  requireValue(['productivity','tools','information','finance','lifestyle','developer','entertainment','other'].includes(c.category), '卡片分类无效');
  requireValue(Array.isArray(c.tags) && c.tags.length <= 16 && new Set(c.tags).size === c.tags.length && c.tags.every(tag => typeof tag === 'string' && tag.trim() && tag.length <= 64), '卡片标签无效');
  fields(c.icon, ['kind','value','backgroundColor'], 'icon');
  requireValue(['text','image'].includes(c.icon.kind) && typeof c.icon.value === 'string' && c.icon.value.trim() && c.icon.value.length <= (c.icon.kind === 'text' ? 16 : 1024), '卡片图标无效');
  requireValue(c.icon.backgroundColor === undefined || /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(c.icon.backgroundColor), '图标背景色无效');
  requireValue(bytes(JSON.stringify(value)) <= AI_CARD_MAX_BYTES, '文件超过 8 MB，请精简后重新上传');
  return value;
}
export async function readAICardFile(file) {
  requireValue(file && /\.json$/i.test(file.name), '请选择 .json 格式的 AI 卡片文件');
  requireValue(file.size > 0 && file.size <= AI_CARD_MAX_BYTES, '文件为空或超过 8 MB，请重新选择');
  let value;
  try { value = JSON.parse(await file.text()); }
  catch { throw new Error('JSON 格式有误，请检查文件内容'); }
  return validateAICardPackage(value);
}
export function importedAICardSize(pkg) {
  const [w, h] = (pkg.artifact.manifest.catalog?.defaultSize || '3x3').split('x').map(Number);
  // The production grid uses three units for a square; this demo uses two.
  return { w: Math.max(2, Math.min(8, Math.round(w * 2 / 3))), h: Math.max(1, Math.min(8, Math.round(h * 2 / 3))) };
}
