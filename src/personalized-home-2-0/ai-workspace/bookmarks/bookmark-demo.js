// Local sample library; these are public website addresses, not connected accounts.
const folder = (key, title, children) => ({ key, title, children });
const link = (title, url) => ({ title, url });
export const BOOKMARK_DEMO_VERSION = 'nested-20261102';
const samples = {
  toolbar: [
    folder('work', '工作台', [
      folder('collaboration', '项目协作', [link('飞书', 'https://www.feishu.cn/'), link('Notion', 'https://www.notion.so/'), link('Linear', 'https://linear.app/'), folder('product', '产品设计', [link('Figma', 'https://www.figma.com/'), link('FigJam', 'https://www.figma.com/figjam/')])]),
      folder('documents', '文档与白板', [link('腾讯文档', 'https://docs.qq.com/'), link('语雀', 'https://www.yuque.com/'), link('Excalidraw', 'https://excalidraw.com/')]),
      link('Google Calendar', 'https://calendar.google.com/'), link('Gmail', 'https://mail.google.com/'),
    ]),
    folder('development', '开发工具', [
      folder('frontend', '前端开发', [folder('react', 'React 生态', [link('React 文档', 'https://react.dev/'), link('Next.js 文档', 'https://nextjs.org/docs'), link('Radix UI', 'https://www.radix-ui.com/')]), link('MDN Web Docs', 'https://developer.mozilla.org/zh-CN/'), link('Vite', 'https://vite.dev/')]),
      folder('debug', '调试与部署', [link('Chrome DevTools', 'https://developer.chrome.com/docs/devtools/'), link('Vercel', 'https://vercel.com/'), link('Netlify', 'https://www.netlify.com/')]),
      link('GitHub', 'https://github.com/'),
    ]),
    folder('ai', 'AI 常用', [folder('assistants', '对话助手', [link('ChatGPT', 'https://chatgpt.com/'), link('Claude', 'https://claude.ai/'), link('DeepSeek', 'https://chat.deepseek.com/')]), folder('research', '研究与检索', [link('Perplexity', 'https://www.perplexity.ai/'), link('Hugging Face', 'https://huggingface.co/'), link('arXiv', 'https://arxiv.org/')])]),
    folder('inspiration', '灵感速览', [folder('interfaces', '界面与动效', [link('Dribbble', 'https://dribbble.com/'), link('Awwwards', 'https://www.awwwards.com/'), link('Mobbin', 'https://mobbin.com/')]), link('Are.na', 'https://www.are.na/'), link('Behance', 'https://www.behance.net/')]),
    folder('daily', '每日阅读', [folder('technology', '科技与产品', [link('Hacker News', 'https://news.ycombinator.com/'), link('Product Hunt', 'https://www.producthunt.com/'), link('少数派', 'https://sspai.com/')]), link('阮一峰的网络日志', 'https://www.ruanyifeng.com/blog/')]),
    link('Google', 'https://www.google.com/'), link('GitHub Explore', 'https://github.com/explore'), link('Figma Community', 'https://www.figma.com/community'), link('YouTube', 'https://www.youtube.com/'), link('哔哩哔哩', 'https://www.bilibili.com/'), link('知乎', 'https://www.zhihu.com/'), link('Wikipedia', 'https://www.wikipedia.org/'), link('Unsplash', 'https://unsplash.com/'),
  ],
  folders: [
    folder('design-library', '产品与设计资料', [
      folder('systems', '设计系统', [folder('platforms', '平台规范', [link('Apple Human Interface Guidelines', 'https://developer.apple.com/design/human-interface-guidelines/'), link('Material Design', 'https://m3.material.io/'), link('Fluent 2', 'https://fluent2.microsoft.design/')]), link('Ant Design', 'https://ant.design/'), link('Carbon Design System', 'https://carbondesignsystem.com/')]),
      folder('ux', '用户体验研究', [link('Nielsen Norman Group', 'https://www.nngroup.com/'), link('Baymard Institute', 'https://baymard.com/'), link('Laws of UX', 'https://lawsofux.com/')]),
      folder('assets', '设计素材', [link('Lucide Icons', 'https://lucide.dev/'), link('Google Fonts', 'https://fonts.google.com/'), link('Open Peeps', 'https://www.openpeeps.com/')]),
    ]),
    folder('learning-library', '学习与阅读', [
      folder('engineering', '技术学习', [folder('llm', 'AI 与机器学习', [link('Hugging Face Learn', 'https://huggingface.co/learn'), link('DeepLearning.AI', 'https://www.deeplearning.ai/'), link('Google Machine Learning', 'https://developers.google.com/machine-learning')]), link('The Missing Semester', 'https://missing.csail.mit.edu/'), link('web.dev', 'https://web.dev/')]),
      folder('longform', '长文与书籍', [link('Stripe Press', 'https://press.stripe.com/'), link('Paul Graham Essays', 'https://paulgraham.com/articles.html'), link('Project Gutenberg', 'https://www.gutenberg.org/')]),
    ]),
    folder('life', '生活与旅行', [folder('travel', '旅行计划', [folder('japan', '日本旅行', [link('Japan Travel', 'https://www.japan.travel/en/'), link('京都旅游', 'https://kyoto.travel/en/')]), link('Google Maps', 'https://maps.google.com/')]), folder('photography', '摄影与音乐', [link('Pexels', 'https://www.pexels.com/'), link('Flickr', 'https://www.flickr.com/'), link('Bandcamp', 'https://bandcamp.com/')])]),
    link('Internet Archive', 'https://archive.org/'), link('Smashing Magazine', 'https://www.smashingmagazine.com/'), link('A List Apart', 'https://alistapart.com/'),
  ],
};

export function supplementBookmarkDemo(library) {
  if (library.demoVersion === BOOKMARK_DEMO_VERSION) return library;
  const nodes = [...library.nodes], ids = new Set(nodes.map(node => node.id));
  function append(items, parentId, prefix) {
    const offset = Math.max(-1, ...nodes.filter(node => node.parentId === parentId).map(node => node.order || 0)) + 1;
    items.forEach((item, index) => {
      const base = `bm-demo-${prefix}-${item.key || index}`;
      let id = base, suffix = 1;
      while (ids.has(id)) id = `${base}-${suffix++}`;
      ids.add(id);
      nodes.push({ id, kind: item.children ? 'folder' : 'bookmark', title: item.title, parentId, order: offset + index,
        createdAt: Date.UTC(2026, 9, 20 + index % 10), demo: true, ...(item.url ? { url: item.url } : {}) });
      if (item.children) append(item.children, id, `${prefix}-${item.key}`);
    });
  }
  for (const root of ['toolbar', 'folders']) append(samples[root], library.rootIds[root], root);
  return { ...library, nodes, demoVersion: BOOKMARK_DEMO_VERSION, revision: `${library.revision || 'initial'}:${BOOKMARK_DEMO_VERSION}` };
}
