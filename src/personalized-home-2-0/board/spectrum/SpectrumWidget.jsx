import { InfoWidgetContent } from './InfoWidgets';
import { TaskWidgetContent } from './TaskWidgets';
import { ExtraWidgetContent } from './ExtraWidgets';
import { LeisureWidgetContent } from './LeisureWidgets';
import { AudioVisualizerWidget } from './AudioVisualizerWidget';
import { WidgetLocaleProvider } from './UnifiedWidgetKit';
import './base.css';
import './leisure-v3.css';

const infoKinds = new Set(['clock', 'calendar', 'quote', 'codex-usage', 'weather', 'news']);
const extraKinds = new Set(['world-clock', 'habits', 'hydration', 'reading', 'anniversary', 'breathing', 'quick-links', 'weekly-goals', 'expenses', 'time-progress']);
const leisureKinds = new Set(['joke', 'image', 'workday-countdown']);

/** A second visual family with the same persisted widget configuration contract. */
export default function SpectrumWidget({ kind, config, size, onChange, preview = false, active = true, locale = 'zh-CN' }) {
  const Content = infoKinds.has(kind) ? InfoWidgetContent
    : extraKinds.has(kind) ? ExtraWidgetContent
      : leisureKinds.has(kind) ? LeisureWidgetContent
        : kind === 'audio-visualizer' ? AudioVisualizerWidget : TaskWidgetContent;
  return <div className="v3-scope personalized-home" data-kind={kind} data-theme="dark" data-widget-family="spectrum">
    <div className="v3-card"><WidgetLocaleProvider locale={locale}>
      <Content kind={kind} config={config} size={size} onChange={onChange} preview={preview} active={active} locale={locale} appearanceTheme="dark"/>
    </WidgetLocaleProvider></div>
  </div>;
}
