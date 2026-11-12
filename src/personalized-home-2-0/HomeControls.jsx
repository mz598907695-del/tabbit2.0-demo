import { useLayoutEffect, useState } from 'react';
import { BROWSER_LAYOUT_SETTLED_EVENT, isBrowserLayoutChanging } from '../browserLayoutMotion';
import { PaletteIcon } from './PaletteIcon';
import { PromotionCarousel } from './PromotionCarousel';
import { PageIndicator } from './PageIndicator';

export function ThemeEntry({ triggerRef, expanded, onClick }) {
  const [settling, setSettling] = useState(false);
  useLayoutEffect(() => {
    const waiting = !expanded && isBrowserLayoutChanging();
    setSettling(waiting);
    if (!waiting) return;
    const settled = () => {
      setSettling(false);
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener(BROWSER_LAYOUT_SETTLED_EVENT, settled, { once: true });
    return () => window.removeEventListener(BROWSER_LAYOUT_SETTLED_EVENT, settled);
  }, [expanded, triggerRef]);
  if (expanded || settling) return null;
  return <aside className="corner-tools" aria-label="首页设置">
    <button type="button" className="theme-button" ref={triggerRef} data-popover-trigger
      aria-label="主题" title="主题" aria-expanded={false} aria-controls="theme-settings-panel" onClick={onClick}
    >
      <PaletteIcon size={16} aria-hidden="true"/>
    </button>
  </aside>;
}

export default function HomeControls({ promotionProps, pageProps, announcement }) {
  return <>
    {promotionProps && <aside className="corner-promotion" aria-label="首页活动">
      <PromotionCarousel {...promotionProps}/>
    </aside>}
    {pageProps && <PageIndicator {...pageProps}/>}
    <span className="page-indicator-sr-only" role="status" aria-live="polite">{announcement}</span>
  </>;
}
