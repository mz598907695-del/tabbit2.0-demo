const PUBLIC_PREFIX = '#skill-public=';
const MAX_PAYLOAD = 300000;
const REVOKED_KEY = 'tabbit.skill-publications.revoked.v1';
const text = (value, max = 60000) => typeof value === 'string' ? value.slice(0, max) : '';
const copy = value => JSON.parse(JSON.stringify(value));

// Public snapshots explicitly select fields: editor/runtime preferences never enter the link.
export function publicSkillSnapshot(item, fields = {}) {
  const cover = fields.cover ?? item.publication?.cover ?? '';
  return {
    id: text(item.id, 160), title: text(item.title, 100), author: text(item.author || '我', 100),
    skillType: ['prompt', 'script', 'task'].includes(item.skillType) ? item.skillType : 'prompt',
    category: text(fields.category ?? item.category, 60), description: text(fields.description ?? item.description, 2000),
    prompt: text(item.prompt), code: text(item.code || item.script), skillMarkdown: text(item.skillMarkdown), taskDescription: text(item.taskDescription, 4000),
    variables: Array.isArray(item.variables) ? item.variables.slice(0, 50).map(v => ({name:text(v.name, 80), defaultValue:text(v.defaultValue, 2000)})) : [],
    websites: Array.isArray(item.websites) ? item.websites.slice(0, 50).map(s => text(s, 500)) : [],
    examples: (fields.examples ?? item.publication?.examples ?? []).slice(0, 10).map(s => text(s, 500)),
    cover: /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(cover) && cover.length <= 180000 ? cover : '',
    installCount: Number.isFinite(item.installCount) ? Math.max(0, item.installCount) : null,
  };
}

export function getSkillVersions(item) {
  if (Array.isArray(item.versions) && item.versions.length) return item.versions.map(copy);
  return [{ version: item.version || '1.0', publishedAt: item.updatedAt || item.date || null, snapshot: publicSkillSnapshot(item) }];
}

function validatePublicationContent(item, fields) {
  const check = (value, max, label) => {
    if (value != null && typeof value !== 'string') throw new Error(`${label}格式不正确。`);
    if ((value || '').length > max) throw new Error(`${label}超过 ${max.toLocaleString('zh-CN')} 字符，无法完整发布，请缩短后重试。`);
  };
  for (const [key, max, label] of [['id',160,'妙招标识'],['title',100,'妙招名称'],['author',100,'创建者名称'],['prompt',60000,'提示词内容'],['code',60000,'脚本代码'],['script',60000,'脚本代码'],['skillMarkdown',60000,'SKILL.md'],['taskDescription',4000,'任务描述']]) check(item[key],max,label);
  check(fields.description ?? item.description,2000,'公开简介');
  check(fields.category ?? item.category,60,'分类');
  const checkArray = (values, max, label, validate) => {
    if (values == null) return;
    if (!Array.isArray(values)) throw new Error(`${label}格式不正确。`);
    if (values.length > max) throw new Error(`${label}最多支持 ${max} 项，请调整后重试。`);
    values.forEach(validate);
  };
  checkArray(item.variables,50,'变量',v=>{
    if (!v || typeof v !== 'object') throw new Error('变量格式不正确。');
    check(v.name,80,'变量名称'); check(v.defaultValue,2000,'变量默认值');
  });
  checkArray(item.websites,50,'适用网站',s=>check(s,500,'适用网站规则'));
  checkArray(fields.examples ?? item.publication?.examples,10,'示例问法',s=>check(s,500,'示例问法'));
  const cover = fields.cover ?? item.publication?.cover;
  if (cover && (typeof cover !== 'string' || cover.length > 180000 || !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(cover))) throw new Error('封面格式不正确或过大，请重新上传。');
}

export function publishSkill(item, fields, now = new Date().toISOString()) {
  if (item.type !== 'custom') throw new Error('仅可发布自己创建的妙招。');
  if (!fields.description?.trim()) throw new Error('请填写公开简介。');
  if (!fields.originality) throw new Error('请确认原创或已获得分享授权。');
  validatePublicationContent(item, fields);
  const previous = item.publication;
  const minor = previous?.version ? Number(previous.version.split('.')[1]) + 1 : 0;
  const version = `1.${Number.isFinite(minor) ? minor : 0}`;
  const publicationId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const snapshot = {...publicSkillSnapshot(item, fields), version, updatedAt:now};
  const publication = { status:'published', visibility:fields.visibility === 'plaza' ? 'plaza' : 'link', version, publicationId, publishedAt:now, description:fields.description.trim(), category:fields.category, examples:fields.examples || [], cover:snapshot.cover, originality:true, snapshot };
  const versions = [...(Array.isArray(item.versions) ? item.versions : [])];
  if (previous?.snapshot && !versions.some(v => v.version === previous.version)) versions.unshift({version:previous.version,publishedAt:previous.publishedAt,snapshot:copy(previous.snapshot)});
  versions.unshift({version,publishedAt:now,snapshot:copy(snapshot)});
  const result = {...item, publication, versions, version, updatedAt:now};
  buildSkillPublicUrl(result, 'https://example.invalid/'); // Validate before a state mutation.
  return result;
}

export function unpublishSkill(item) {
  if (!item.publication) return item;
  return {...item, publication:{...item.publication,status:'unpublished'}};
}

export function revokeSkillPublications(item, storage = globalThis.localStorage) {
  if (!storage || !item.id) return;
  const entries = JSON.parse(storage.getItem(REVOKED_KEY) || '{}');
  entries[item.id] = Date.now();
  storage.setItem(REVOKED_KEY, JSON.stringify(entries));
}

export function isSkillPublicRevoked(id, publishedAt, storage = globalThis.localStorage) {
  try { const cutoff = JSON.parse(storage?.getItem(REVOKED_KEY) || '{}')[id]; return Boolean(cutoff && Date.parse(publishedAt) <= cutoff); }
  catch { return false; }
}

function encode(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > 210000) throw new Error('公开内容过大，请缩短正文或换一张较小封面。');
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function buildSkillPublicUrl(item, baseUrl = globalThis.location?.href || 'http://localhost:1420/') {
  if (item.publication?.status !== 'published') throw new Error('请先发布妙招。');
  const url = new URL(baseUrl); url.hash = PUBLIC_PREFIX + encode({schema:1,sourceId:item.id,publicationId:item.publication.publicationId,publishedAt:item.publication.publishedAt,visibility:item.publication.visibility,skill:item.publication.snapshot,versions:getSkillVersions(item).map(v=>({version:v.version,publishedAt:v.publishedAt}))});
  return url.href;
}
export function parseSkillPublicHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(PUBLIC_PREFIX)) return null;
  const value = hash.slice(PUBLIC_PREFIX.length);
  if (!value || value.length > MAX_PAYLOAD || !/^[a-zA-Z0-9_-]+$/.test(value)) return null;
  try {
    const raw = Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(raw));
    if (payload.schema !== 1 || !payload.skill?.title || typeof payload.sourceId !== 'string' || typeof payload.publicationId !== 'string' || !Number.isFinite(Date.parse(payload.publishedAt))) return null;
    if (isSkillPublicRevoked(payload.sourceId,payload.publishedAt)) return null;
    const snapshot = publicSkillSnapshot(payload.skill,{...payload.skill});
    const versions = Array.isArray(payload.versions) ? payload.versions.filter(v=>typeof v?.version === 'string').map(v=>({version:text(v.version,30),publishedAt:text(v.publishedAt,40) || null,...(v.version === payload.skill.version ? {snapshot:copy({...snapshot,version:payload.skill.version})} : {})})) : [];
    return {...snapshot,versions,id:payload.sourceId,sourceId:payload.sourceId,publicationId:payload.publicationId,publishedAt:payload.publishedAt,version:text(payload.skill.version,30),updatedAt:payload.publishedAt,type:'community',installed:false,enabled:true,publicView:true,visibility:payload.visibility === 'plaza' ? 'plaza' : 'link',images:snapshot.cover ? [{src:snapshot.cover,alt:`${snapshot.title}封面`}] : []};
  } catch { return null; }
}
