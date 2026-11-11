import { copyBookmarkNodes, makeId, ordered, parseBookmarkLibrary, safeBookmarkUrl } from './bookmark-model.js';

const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function exportBookmarkHtml(library, ids) {
  const nodes = copyBookmarkNodes(library, ids);
  const render = parentId => ordered(nodes.filter(node => node.parentId === parentId)).map(node => {
    const date = node.createdAt ? ` ADD_DATE="${Math.floor(node.createdAt / 1000)}"` : '';
    const metadata = ` DATA-NOTE="${escape(node.note)}" DATA-EXCERPT="${escape(node.excerpt)}" DATA-LATER="${node.later ? '1' : '0'}"`;
    return node.kind === 'folder' ? `<DT><H3${date}>${escape(node.title)}</H3>\n<DL><p>\n${render(node.id)}</DL><p>\n`
      : `<DT><A HREF="${escape(safeBookmarkUrl(node.url))}"${date}${metadata}>${escape(node.title)}</A>\n${node.note ? `<DD>${escape(node.note)}\n` : ''}`;
  }).join('');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Tabbit 收藏</TITLE>\n<H1>Tabbit 收藏</H1>\n<DL><p>\n${render(null)}</DL><p>\n`;
}

export function importBookmarkText(text, parser, filename = '') {
  if (/\.json$/i.test(filename) || text.trim().startsWith('{')) {
    const library = parseBookmarkLibrary(text);
    const nodes = copyBookmarkNodes(library, library.nodes.filter(node => !node.deletedAt && !node.parentId).map(node => node.id));
    const invalid = nodes.filter(node => node.kind === 'bookmark' && !safeBookmarkUrl(node.url)).length;
    return { nodes: nodes.filter(node => node.kind === 'folder' || safeBookmarkUrl(node.url)), skipped: invalid };
  }
  const document = parser.parseFromString(text, 'text/html'), nodes = [];
  const root = document.querySelector('dl');
  if (!root) throw new Error('请选择浏览器导出的收藏 HTML 文件或 Tabbit JSON 备份。');
  let skipped = 0;
  function walk(list, parentId) {
    let order = 0;
    for (const entry of list.children) {
      if (entry.tagName !== 'DT') continue;
      const heading = [...entry.children].find(child => child.tagName === 'H3');
      const link = [...entry.children].find(child => child.tagName === 'A');
      const source = heading || link;
      if (!source) continue;
      const url = link ? safeBookmarkUrl(link.getAttribute('href')) : '';
      if (link && !url) { skipped += 1; continue; }
      const node = { id: makeId(), kind: heading ? 'folder' : 'bookmark', title: source.textContent.trim() || (heading ? '未命名文件夹' : url), parentId, order: order++, createdAt: Math.max(0, Number(source.getAttribute('add_date')) || 0) * 1000 };
      if (link) {
        const description = entry.nextElementSibling?.tagName === 'DD' ? entry.nextElementSibling.textContent.trim() : '';
        Object.assign(node, { url, note: link.getAttribute('data-note') || description, excerpt: link.getAttribute('data-excerpt') || '', later: link.getAttribute('data-later') === '1' });
      }
      nodes.push(node);
      if (heading) {
        const child = [...entry.children].find(element => element.tagName === 'DL') || (entry.nextElementSibling?.tagName === 'DL' ? entry.nextElementSibling : null);
        if (child) walk(child, node.id);
      }
    }
  }
  walk(root, null);
  if (!nodes.length) throw new Error('文件中没有可导入的文件夹或 HTTP / HTTPS 收藏。');
  return { nodes, skipped };
}

export function bookmarkResourceList(links) {
  return links.map(node => `- [${node.title.replace(/[\[\]\\]/g, '\\$&').replace(/\n/g, ' ')}](${node.url.replace(/\(/g, '%28').replace(/\)/g, '%29')})${node.note ? `\n  ${node.note.replace(/\n/g, '\n  ')}` : ''}`).join('\n');
}

export function downloadBookmarkFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
