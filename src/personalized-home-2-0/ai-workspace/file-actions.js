/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
function safeFilename(title) {
  const cleaned = String(title || '未命名文件')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  const name = Array.from(cleaned || '未命名文件').slice(0, 120).join('');
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `文件_${name}` : name;
}

export function findFileSource(file, chats = []) {
  if (!file || file.sourceDeleted) return null;
  const byId = file.sourceId && chats.find(chat => chat.id === file.sourceId);
  return byId || (file.source && chats.find(chat => chat.title === file.source)) || null;
}

export function getFileShareText(file = {}) {
  return [file.title || '未命名输出物', file.description, [file.format, file.size, file.date].filter(Boolean).join(' · '), '', 'Tabbit 本地示例摘要，非原始文件或公开链接。'].filter(value => value !== undefined).join('\n');
}

export function refreshWorkspaceOutputs(current, serialized) {
  const saved = JSON.parse(serialized);
  if (!saved || !['files', 'assets'].every(key => Array.isArray(saved[key]) && saved[key].every(item => item && typeof item.id === 'string'))) {
    throw new Error('未找到有效的本地输出物记录');
  }
  // Refresh only the output collections; never reset other pages to demo defaults.
  return { ...current, files: saved.files, assets: saved.assets };
}

export function getFileDownload(file = {}) {
  const name = safeFilename(file.title);
  // Only an existing root-relative image can be offered as the original asset.
  // Leading whitespace/control characters and backslashes must not be URL-normalized away.
  if (file._outputSource?.collection !== 'assets' && typeof file.image === 'string' && file.image.startsWith('/') && !file.image.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(file.image)) {
    const pathname = file.image.split(/[?#]/, 1)[0];
    const extension = pathname.match(/\.([a-z0-9]{1,10})$/i)?.[0] || '';
    return {
      href: file.image,
      filename: extension && !name.toLowerCase().endsWith(extension.toLowerCase()) ? `${name}${extension}` : name,
      kind: 'original',
    };
  }
  return {
    text: [
      'Tabbit 本地示例 · 文件摘要',
      '此文件仅包含原型中的示例元数据，不是原始文件。',
      '',
      `名称：${file.title || '未命名文件'}`,
      `类型 / 格式：${file.format || file.type || '未知'}`,
      `说明：${file.description || '暂无说明'}`,
      `来源：${file.source || file.sourceId || '无来源记录'}`,
      ...(file.size ? [`大小（记录值）：${file.size}`] : []),
      ...(file.date ? [`时间（记录值）：${file.date}`] : []),
      '',
    ].join('\n'),
    filename: `${name}.txt`,
    kind: 'summary',
  };
}
