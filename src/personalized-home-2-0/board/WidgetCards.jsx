import BoardCard from './BoardCard';
import { memo, useRef, useState } from 'react';
import { useWidgetActivity } from './useWidgetActivity';
import './widget-cards.css';
import { coreWidgetCatalog } from './core-widget-data';
import { extraWidgetCatalog } from './extra-widget-data';
import { leisureWidgetCatalog } from './leisure-widget-data';
import { CoreWidgetContent } from './CoreWidgets';
import { ExtraWidgetContent } from './ExtraWidgets';
import { LeisureWidgetContent } from './LeisureWidgets';
import ImportedAICard from './ImportedAICard';
import { WidgetLocaleProvider } from './UnifiedWidgetKit';
import { audioWidgetCatalog } from './audio-widget-catalog';
import { AudioVisualizerWidget } from './AudioVisualizerWidget';
import SpectrumWidget from './spectrum/SpectrumWidget';

export const widgetCatalog = [...coreWidgetCatalog, ...extraWidgetCatalog, ...leisureWidgetCatalog, ...audioWidgetCatalog];
const coreKinds = new Set(coreWidgetCatalog.map(entry => entry.kind));
const extraKinds = new Set(extraWidgetCatalog.map(entry => entry.kind));
// The shared board frame remains the only owner of the card material and rim.
const spectrumSurface = {
  '--home-content-surface-fill': '#030405',
  '--board-card-noise': 'none',
  '--board-card-backdrop': 'none',
  '--board-card-brightness': 1,
  '--board-card-outline': '0',
  '--board-card-lighting': 'none',
};
/** The board owns the frame and placement; each widget owns its actual task. */
export const WidgetCard = memo(function WidgetCard({ kind, item = {}, size, onChange, inert = false, preview = false, active = true, appearanceTheme = 'light' }) {
  const ref = useRef(null);
  const { visible, near } = useWidgetActivity(ref, active || preview || inert);
  // Keep any interacted-with widget alive so drafts, calculator input and open
  // dialogs survive scrolling. Persisted timers must also complete offscreen.
  const [retained, setRetained] = useState(false);
  const requestedKind = kind || item.kind || 'note';
  const resolvedKind = requestedKind === 'reminder' ? 'note' : requestedKind;
  const definition = widgetCatalog.find(entry => entry.kind === resolvedKind);
  const config = { ...(definition?.defaultConfig || {}), ...(item.config || {}) };
  // Completion bookkeeping must still run for an in-progress task even when
  // its card scrolls away. Ordinary clocks/charts only update in the viewport.
  const runningTask = (resolvedKind === 'pomodoro' && Number(config.endAt) > 0)
    || (resolvedKind === 'breathing' && Number(config.startedAt) > 0);
  if (requestedKind === 'reminder' && !config.text && Array.isArray(config.lines)) config.text = config.lines.map(line => typeof line === 'string' ? line : line?.text || '').join('\n');
  const spectrum = config.visualStyle === 'spectrum' && resolvedKind !== 'ai-card';
  const Content = spectrum ? SpectrumWidget : resolvedKind === 'ai-card' ? ImportedAICard : resolvedKind === 'audio-visualizer' ? AudioVisualizerWidget : coreKinds.has(resolvedKind) ? CoreWidgetContent : extraKinds.has(resolvedKind) ? ExtraWidgetContent : LeisureWidgetContent;
  const locale = config.locale === 'en-US' ? 'en-US' : 'zh-CN';
  const mounted = visible || near || retained || runningTask || resolvedKind === 'ai-card';
  return <BoardCard ref={ref} className={`board-widget-card widget-unified${spectrum ? ' widget-spectrum' : ''}`} style={spectrum ? spectrumSurface : undefined} inert={inert} data-widget-kind={resolvedKind} data-widget-style={spectrum ? 'spectrum' : 'classic'}
    data-widget-active={visible && active && !preview && !inert} data-widget-mounted={mounted} data-widget-near={near || visible}
    onPointerDownCapture={() => setRetained(true)} onFocusCapture={() => setRetained(true)}
    data-widget-width={size?.w} data-widget-height={size?.h} aria-label={item.title || definition?.title || 'AI 卡片'}>
    {mounted && <WidgetLocaleProvider locale={locale}>
      <Content kind={resolvedKind} config={config} size={size} onChange={onChange} preview={preview || inert} active={visible || (active && !inert && !preview && runningTask)} locale={locale} appearanceTheme={appearanceTheme}/>
    </WidgetLocaleProvider>}
  </BoardCard>;
}, (a, b) => a.kind === b.kind && a.item?.id === b.item?.id && a.item?.kind === b.item?.kind
  && a.item?.title === b.item?.title && a.item?.config === b.item?.config
  && a.size?.w === b.size?.w && a.size?.h === b.size?.h && a.onChange === b.onChange
  && a.inert === b.inert && a.preview === b.preview && a.active === b.active && a.appearanceTheme === b.appearanceTheme);
export default WidgetCard;
