import { Composer } from './Composer';
import { useRef } from 'react';
import { useWindBrandMotion } from './themes/useWindBrandMotion';
import WorkspaceBoard from './board/WorkspaceBoard';
import { PromotionInlineCarousel } from './PromotionInlineCarousel';
import { spaceColors } from '../spaceColors';

function BrandMark({ appIconIndex, spaceColor }) {
  if (appIconIndex > 0) return <img className="brand-mark brand-mark-app-icon" src={`/personalized-home-2-0/asset/images/app-icons/${appIconIndex + 1}.webp`} alt="" width="60" height="60" draggable="false"/>;
  const colorIndex = spaceColors.findIndex(item => item.tintColor.toLowerCase() === spaceColor.toLowerCase());
  if (colorIndex > 0) return <span className="brand-mark brand-mark-tinted" style={{ '--brand-mark-color':spaceColors[colorIndex].color }} aria-hidden="true" />;
  return <span className="brand-mark brand-mark-default" aria-hidden="true" />;
}

export default function HomeContent({ pageWidth, showShortcuts, onToggleShortcuts, appIconIndex = 0, spaceColor = '#f2f7ff', wallpaper, composerProps, promotionProps, boardProps }) {
  const windRef = useRef(null);
  useWindBrandMotion(windRef, wallpaper);
  return <div className="home-scroll">
    <section className="home-content" data-page-width={pageWidth} aria-label="搜索和常用网站">
      <button
        type="button" className="brand-toggle" aria-label="显示快捷方式与小组件"
        aria-pressed={showShortcuts} onClick={onToggleShortcuts}
        title={showShortcuts ? '点击隐藏快捷方式与小组件' : '点击显示快捷方式与小组件'}
      >
        <span ref={windRef} className="brand-wind-motion" aria-hidden="true"><BrandMark appIconIndex={appIconIndex} spaceColor={spaceColor}/></span>
      </button>
      {/* Feed bounds provide the composer's sticky scroll and glass geometry. */}
      <div className="home-feed">
        <Composer {...composerProps}/>
        {promotionProps && <PromotionInlineCarousel {...promotionProps}/>}
        <WorkspaceBoard {...boardProps}/>
      </div>
    </section>
  </div>;
}
