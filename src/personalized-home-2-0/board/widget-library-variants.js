export const WIDGET_VISUAL_STYLES = [
  { id: 'classic', label: '经典版' },
  { id: 'spectrum', label: '光谱版' },
];

// Keep both visual treatments next to one another without duplicating the
// functional catalog or changing the kinds stored in existing boards.
export function widgetLibraryVariants(catalog) {
  const ordered = [...catalog].sort((a, b) => Number(b.kind === 'audio-visualizer') - Number(a.kind === 'audio-visualizer'));
  return ordered.flatMap(definition => WIDGET_VISUAL_STYLES.map(style => ({
    ...definition,
    libraryKey: `${definition.kind}-${style.id}`,
    visualStyle: style.id,
    variantLabel: style.label,
  })));
}

export function createLibraryWidgetItem(definition, { id, size, visualStyle = 'classic' }) {
  const config = { ...(definition.createDefaultConfig?.() || definition.defaultConfig) };
  if (visualStyle === 'spectrum') config.visualStyle = 'spectrum';
  else delete config.visualStyle;
  return {
    id, type: 'widget', kind: definition.kind, title: definition.title,
    config, size: size || definition.defaultSize || { w: 2, h: 2 },
  };
}
