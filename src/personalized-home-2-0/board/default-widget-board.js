import { coreWidgetCatalog } from './core-widget-data.js';
import { extraWidgetCatalog } from './extra-widget-data.js';
import { leisureWidgetCatalog } from './leisure-widget-data.js';
import { audioWidgetCatalog } from './audio-widget-catalog.js';

export const DEFAULT_WIDGET_BOARD_VERSION = 1;
export const DEFAULT_WIDGET_BOARD_COLUMNS = 12;

const catalog = [...coreWidgetCatalog, ...extraWidgetCatalog, ...leisureWidgetCatalog, ...audioWidgetCatalog];

/** Two rows of links, followed by the complete built-in widget collection. */
export function createDefaultWidgetBoard(page, starterLinks = [], reservedIds = []) {
  const previousItems = page.items || [];
  const usedIds = new Set([...reservedIds].map(String));
  const uniqueId = (preferred, fallback) => {
    const base = (typeof preferred === 'string' && preferred) || (typeof preferred === 'number' && Number.isFinite(preferred) ? String(preferred) : fallback);
    let id = base, suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return id;
  };

  const links = starterLinks.slice(0, 24).map((starter, index) => {
    const retained = previousItems.find(item => item.type === 'shortcut' && item.key === starter.key);
    const entry = structuredClone({ ...starter, ...retained });
    return { ...entry, id: uniqueId(entry.id, `default-link-${starter.key || index}`), type: 'shortcut', size: { w: 1, h: 1 }, w: 1, h: 1 };
  });
  const widgets = catalog.map(definition => {
    const retained = previousItems.find(item => item.type === 'widget' && item.kind === definition.kind)
      || (definition.kind === 'note' ? previousItems.find(item => item.type === 'widget' && item.kind === 'reminder') : null);
    const config = structuredClone({ ...definition.defaultConfig, ...retained?.config });
    if (retained?.kind === 'reminder' && !config.text && Array.isArray(config.lines)) {
      config.text = config.lines.map(line => typeof line === 'string' ? line : line?.text || '').join('\n');
    }
    if (!config.locale) config.locale = 'zh-CN';
    return {
      ...structuredClone(retained || {}),
      id: uniqueId(retained?.id, `default-widget-${definition.kind}`),
      type: 'widget', kind: definition.kind, title: retained?.title || definition.title,
      config, size: { w: 6, h: 4 }, w: 6, h: 4,
    };
  });
  const items = [...links, ...widgets];
  const positions = Object.fromEntries([
    ...links.map((item, index) => [item.id, { x: index % DEFAULT_WIDGET_BOARD_COLUMNS, y: Math.floor(index / DEFAULT_WIDGET_BOARD_COLUMNS) }]),
    ...widgets.map((item, index) => [item.id, { x: (index % 2) * 6, y: 2 + Math.floor(index / 2) * 4 }]),
  ]);
  const board = {
    ...page, layoutVersion: 3, defaultWidgetBoardVersion: DEFAULT_WIDGET_BOARD_VERSION,
    preferredColumns: DEFAULT_WIDGET_BOARD_COLUMNS, items,
    layoutOrder: items.map(item => item.id), layouts: { 'gap:free:12': positions },
  };
  delete board.curatedLayoutVersion;
  return board;
}
