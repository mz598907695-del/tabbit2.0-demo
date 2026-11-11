import BoardCard from './BoardCard';
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

export const widgetCatalog = [...coreWidgetCatalog, ...extraWidgetCatalog, ...leisureWidgetCatalog, ...audioWidgetCatalog];
const coreKinds = new Set(coreWidgetCatalog.map(entry => entry.kind));
const extraKinds = new Set(extraWidgetCatalog.map(entry => entry.kind));
/** The board owns the frame and placement; each widget owns its actual task. */
export function WidgetCard({ kind, item = {}, size, onChange, inert = false, preview = false, active = true, appearanceTheme = 'light' }) {
  const requestedKind = kind || item.kind || 'note';
  const resolvedKind = requestedKind === 'reminder' ? 'note' : requestedKind;
  const definition = widgetCatalog.find(entry => entry.kind === resolvedKind);
  const config = { ...(definition?.defaultConfig || {}), ...(item.config || {}) };
  if (requestedKind === 'reminder' && !config.text && Array.isArray(config.lines)) config.text = config.lines.map(line => typeof line === 'string' ? line : line?.text || '').join('\n');
  const Content = resolvedKind === 'ai-card' ? ImportedAICard : resolvedKind === 'audio-visualizer' ? AudioVisualizerWidget : coreKinds.has(resolvedKind) ? CoreWidgetContent : extraKinds.has(resolvedKind) ? ExtraWidgetContent : LeisureWidgetContent;
  const locale = config.locale === 'en-US' ? 'en-US' : 'zh-CN';
  return <BoardCard className="board-widget-card widget-unified" inert={inert} data-widget-kind={resolvedKind}
    data-widget-width={size?.w} data-widget-height={size?.h} aria-label={item.title || definition?.title || 'AI 卡片'}>
    <WidgetLocaleProvider locale={locale} onChange={onChange ? value => onChange({ locale: value }) : undefined}>
      <Content kind={resolvedKind} config={config} size={size} onChange={onChange} preview={preview || inert} active={active && !inert} locale={locale} appearanceTheme={appearanceTheme}/>
    </WidgetLocaleProvider>
  </BoardCard>;
}
export default WidgetCard;
