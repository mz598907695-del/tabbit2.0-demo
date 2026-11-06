import { Composer } from './Composer';
import WorkspaceBoard from './board/WorkspaceBoard';
import { PromotionInlineCarousel } from './PromotionInlineCarousel';
import { OceanReel } from './themes/ocean/OceanReel';
import { asset } from './home-data';
import { spaceColors } from '../spaceColors';

function BrandMark({ appIconIndex, spaceColor }) {
  if (appIconIndex > 0) return <img className="brand-mark brand-mark-app-icon" src={`/personalized-home-2-0/asset/images/app-icons/${appIconIndex + 1}.png`} alt="" width="60" height="60" draggable="false"/>;
  const colorIndex = spaceColors.findIndex(item => item.tintColor.toLowerCase() === spaceColor.toLowerCase());
  if (colorIndex > 0) return <span className="brand-mark brand-mark-tinted" style={{ '--brand-mark-color':spaceColors[colorIndex].color }} aria-hidden="true" />;
  return <img className="brand-mark brand-mark-default" src={asset('svg_73448bfb')} alt="" width="60" height="60" draggable="false"/>;
}

export default function HomeContent({ pageWidth, showShortcuts, onToggleShortcuts, appIconIndex = 0, spaceColor = '#f2f7ff', ocean, composerProps, promotionProps, boardProps }) {
  return <div className="home-scroll">
    <section className="home-content" data-page-width={pageWidth} aria-label="搜索和常用网站">
      {ocean ? <OceanReel {...ocean}/> : <button
        type="button" className="brand-toggle" aria-label="显示快捷方式与小组件"
        aria-pressed={showShortcuts} onClick={onToggleShortcuts}
        title={showShortcuts ? '点击隐藏快捷方式与小组件' : '点击显示快捷方式与小组件'}
      >
        <BrandMark appIconIndex={appIconIndex} spaceColor={spaceColor}/>
      </button>}
      {/* Feed bounds provide the composer's sticky scroll and glass geometry. */}
      <div className="home-feed">
        <Composer {...composerProps}/>
        {promotionProps && <PromotionInlineCarousel {...promotionProps}/>}
        <WorkspaceBoard {...boardProps}/>
      </div>
    </section>
  </div>;
}
