import { coreWidgetCatalog } from './core-widget-data.js';
import { extraWidgetCatalog } from './extra-widget-data.js';
import { leisureWidgetCatalog } from './leisure-widget-data.js';
import { audioWidgetCatalog } from './audio-widget-catalog.js';

export const DEFAULT_WIDGET_BOARD_VERSION = 1;
export const DEFAULT_WIDGET_BOARD_COLUMNS = 12;
export const SPECTRUM_WIDGET_BOARD_VERSION = 1;
export const SPECTRUM_WIDGET_BOARD_ID = 'spectrum-widget-board-v1';

// The visualizer is the first widget after the two rows of shortcut entries.
const catalog = [...audioWidgetCatalog, ...coreWidgetCatalog, ...extraWidgetCatalog, ...leisureWidgetCatalog];

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

/** Create the new visual collection without borrowing personal widget records. */
export function createSpectrumWidgetBoard(starterLinks = [], reservedIds = [], pageId = SPECTRUM_WIDGET_BOARD_ID) {
  const board = createDefaultWidgetBoard({ id: pageId, name: '光谱', items: [] }, starterLinks.map((item, index) => ({
    ...item, id: `spectrum-link-${item.key || index}`,
  })), reservedIds);
  const idMap = new Map();
  const usedIds = new Set(reservedIds.map(String));
  board.items = board.items.map(item => {
    const base = item.type === 'widget' ? `spectrum-widget-${item.kind}` : item.id;
    let id = base, suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    idMap.set(item.id, id);
    return item.type === 'widget'
      ? { ...item, id, config: { ...item.config, visualStyle: 'spectrum' } }
      : { ...item, id };
  });
  board.layoutOrder = board.layoutOrder.map(id => idMap.get(id));
  board.layouts = Object.fromEntries(Object.entries(board.layouts).map(([key, positions]) => [key,
    Object.fromEntries(Object.entries(positions).map(([id, point]) => [idMap.get(id), point])),
  ]));
  delete board.defaultWidgetBoardVersion;
  return { ...board, spectrumWidgetBoardVersion: SPECTRUM_WIDGET_BOARD_VERSION };
}

/** Add the new board once at position two; never reshape an existing board. */
export function ensureSpectrumWidgetBoard(pages, starterLinks = [], appliedVersion = 0) {
  if (appliedVersion >= SPECTRUM_WIDGET_BOARD_VERSION || pages.some(page => page.spectrumWidgetBoardVersion >= SPECTRUM_WIDGET_BOARD_VERSION)) {
    return { pages, spectrumWidgetBoardVersion: Math.max(appliedVersion, SPECTRUM_WIDGET_BOARD_VERSION), added: false };
  }
  // The storage contract supports at most 20 boards. Leave every saved board in
  // place and defer adding the collection until a slot becomes available.
  if (pages.length >= 20) return { pages, spectrumWidgetBoardVersion: appliedVersion, added: false };
  const pageIds = new Set(pages.map(page => String(page.id)));
  let pageId = SPECTRUM_WIDGET_BOARD_ID, suffix = 2;
  while (pageIds.has(pageId)) pageId = `${SPECTRUM_WIDGET_BOARD_ID}-${suffix++}`;
  const reservedIds = pages.flatMap(page => page.items.map(item => item.id));
  const board = createSpectrumWidgetBoard(starterLinks, reservedIds, pageId);
  const next = [...pages];
  next.splice(Math.min(1, next.length), 0, board);
  return { pages: next, spectrumWidgetBoardVersion: SPECTRUM_WIDGET_BOARD_VERSION, added: true };
}
