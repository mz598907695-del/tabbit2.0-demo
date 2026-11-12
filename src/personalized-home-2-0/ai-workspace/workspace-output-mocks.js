// User-supplied previews for the output gallery demo.
export const OUTPUT_DEMO_FILES = [
  ['SOLTERA · 风能与可持续未来', 'web', 1],
  ['设计服务 · 合作流程与须知', 'doc', 2],
  ['Automate · 自动化工作流', 'doc', 3],
  ['Mist in the Blossom · 花间薄雾', 'image', 4],
  ['暮色中的汽车 · 视觉灵感', 'image', 5],
  ['Input → Find → Output', 'image', 6],
  ['A living OS for your brand', 'web', 7],
  ['原野微光 · Prompt #1', 'image', 8],
  ['Impact & Metrics', 'table', 9],
  ['GRAINIENT.SUPPLY · 渐变灵感', 'web', 10],
  ['春天是没有国籍的', 'image', 11],
  ['Wednesday · 海龟汤', 'doc', 12],
].map(([title, type, index]) => ({
  id: `output-reference-${index}`, title, type,
  description: ({web:'网页',doc:'文档',image:'图片',table:'表格'})[type],
  image: `/personalized-home-2-0/asset/outputs/reference-${index}.webp`,
  format: 'WEBP', date: '今天', demo: true,
  sourceId: 'chat-1', source: '首页信息架构，如何再简洁一点',
}));
export const OUTPUT_DEMO_ASSETS = [];

export function mergeOutputDemoData(data) {
  const files = (data.files || []).filter(item => !item.id.startsWith('output-demo-v1-') && !/^file-[1-6]$/.test(item.id));
  const assets = (data.assets || []).filter(item => !item.id.startsWith('output-demo-v1-') && !/^asset-[1-6]$/.test(item.id));
  const fixtures = new Map(OUTPUT_DEMO_FILES.map(item => [item.id, item]));
  const updatedFiles = files.map(item => {
    const fixture = fixtures.get(item.id);
    if (!fixture) return item;
    const legacyImage = item.image === fixture.image.replace(/\.webp$/, '.png');
    return {
      ...item,
      ...(/^\d+$/.test(item.title) ? { title: fixture.title } : {}),
      ...(legacyImage ? { image: fixture.image, format: fixture.format } : {}),
    };
  });
  const ids = new Set(updatedFiles.map(item => item.id));
  return { ...data, files: [...updatedFiles, ...OUTPUT_DEMO_FILES.filter(item => !ids.has(item.id)).map(item => ({ ...item }))], assets };
}
