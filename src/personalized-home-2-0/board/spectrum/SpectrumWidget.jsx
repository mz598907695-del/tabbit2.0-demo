import { useLayoutEffect, useRef, useState } from 'react';
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

function useSpectrumAppearance(rootRef, appearanceTheme) {
  const explicit = appearanceTheme === 'light' || appearanceTheme === 'dark' ? appearanceTheme : null;
  const [inherited, setInherited] = useState('light');
  useLayoutEffect(() => {
    if (explicit) return;
    // Board cards pass their resolved appearance. Standalone galleries inherit
    // the nearest host, and also respond when its appearance changes in place.
    const host = rootRef.current?.parentElement?.closest('[data-theme]') || document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const theme = host.getAttribute('data-theme');
      setInherited(theme === 'light' || theme === 'dark' ? theme : media.matches ? 'dark' : 'light');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(host, { attributes: true, attributeFilter: ['data-theme'] });
    media.addEventListener('change', update);
    return () => { observer.disconnect(); media.removeEventListener('change', update); };
  }, [explicit, rootRef]);
  return explicit || inherited;
}

/** A second visual family with the same persisted widget configuration contract. */
export default function SpectrumWidget({ kind, config, size, onChange, preview = false, active = true, locale = 'zh-CN', appearanceTheme }) {
  const rootRef = useRef(null);
  const theme = useSpectrumAppearance(rootRef, appearanceTheme);
  const Content = infoKinds.has(kind) ? InfoWidgetContent
    : extraKinds.has(kind) ? ExtraWidgetContent
      : leisureKinds.has(kind) ? LeisureWidgetContent
        : kind === 'audio-visualizer' ? AudioVisualizerWidget : TaskWidgetContent;
  return <div ref={rootRef} className="v3-scope personalized-home" data-kind={kind} data-theme={theme} data-widget-family="spectrum">
    <div className="v3-card"><WidgetLocaleProvider locale={locale}>
      <Content kind={kind} config={config} size={size} onChange={onChange} preview={preview} active={active} locale={locale} appearanceTheme={theme}/>
    </WidgetLocaleProvider></div>
  </div>;
}
