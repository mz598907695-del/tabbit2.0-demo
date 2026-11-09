import { PaletteIcon } from './PaletteIcon';
import { PromotionCarousel } from './PromotionCarousel';
import { PageIndicator } from './PageIndicator';

export default function HomeControls({ promotionProps, themeButtonProps, pageProps, announcement }) {
  const {ref, expanded, onClick} = themeButtonProps;
  return <>
    <aside className="corner-tools" aria-label="首页设置">
      <button type="button" className="theme-button" ref={ref} data-popover-trigger
        aria-label="主题" title="主题" aria-expanded={expanded} aria-controls="theme-settings-panel" onClick={onClick}
      >
        <PaletteIcon size={16} aria-hidden="true"/>
      </button>
    </aside>
    {promotionProps && <aside className="corner-promotion" aria-label="首页活动">
      <PromotionCarousel {...promotionProps}/>
    </aside>}
    {pageProps && <PageIndicator {...pageProps}/>}
    <span className="page-indicator-sr-only" role="status" aria-live="polite">{announcement}</span>
  </>;
}
