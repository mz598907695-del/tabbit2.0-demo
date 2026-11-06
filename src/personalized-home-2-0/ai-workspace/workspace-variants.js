export const WORKSPACE_VARIANTS = [
  { id: 1, name: '经典对话栏', short: '经典', lead: '从对话出发，功能入口集中在上方。', good: '迁移成本低，接近设计原稿', tradeoff: '功能和会话历史共享纵向空间' },
  { id: 2, name: '分组直达', short: '分组', lead: '工作、资料与管理，各有固定位置。', good: '功能一眼可见，适合日常使用', tradeoff: '会话历史在侧栏中的空间略少' },
  { id: 3, name: '双栏工作区', short: '双栏', lead: '功能轨保持稳定，旁边呈现当前上下文。', good: '跨功能切换快，适合高频使用', tradeoff: '占用更多宽度，需要熟悉图标' },
  { id: 4, name: '行动优先', short: '行动', lead: '先看到正在推进的事情，再进入资料和工具。', good: '任务与下一次执行更突出', tradeoff: '资料入口的优先级相对降低' },
  { id: 5, name: '内容中枢', short: '内容', lead: '文件、成果、收藏和分享成为可复用的内容入口。', good: '查找和复用内容更直接', tradeoff: '不以会话历史作为第一入口' },
  { id: 6, name: '轻轨导航', short: '轻轨', lead: '用一条轻巧的功能轨，把空间留给内容。', good: '入口稳定，首页和内容区更宽敞', tradeoff: '会话历史需要在右侧查看' },
  { id: 7, name: '目录导航', short: '目录', lead: '左侧展开分类，右侧边浏览边预览。', good: '资料分类清楚，比较内容不用反复开关弹窗', tradeoff: '长目录需要折叠，预览会占用横向空间' },
  { id: 8, name: '总览工作台', short: '总览', lead: '把最近工作和待处理事项放在同一个起点。', good: '跨模块接续工作，减少来回查找', tradeoff: '多一个总览入口，需要与首页区分' },
];

export function resolveWorkspaceVariant(fromUrl, stored) {
  const valid = value => WORKSPACE_VARIANTS.some(item => item.id === Number(value));
  return valid(fromUrl) ? Number(fromUrl) : valid(stored) ? Number(stored) : 1;
}
