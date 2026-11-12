import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ImagePlus, RefreshCw, Trash2, X } from './icons';
import { isWallpaperTheme, WALLPAPER_ACCEPT } from './themes/wallpapers';
import { getBundledWallpaper } from './themes/officialWallpapers';
import { officialWallpapers as officialThemes, communityWallpapers as communityThemes, isOfficialWallpaperTheme, isCommunityWallpaperTheme } from './themes/officialWallpapers';
import WallpaperMedia from './themes/WallpaperMedia';
import { BoardConfirm } from './board/BoardDialogs';
import SettingSegments from './SettingSegments';
import { spaceColors } from '../spaceColors';
import { APP_ICON_OPTIONS } from './appIcons';
import './overlays.css';

function GalleryPreview({ item }) {
  if (item.preview || item.posterUrl) return <span className="overlay-scene-preview is-loaded" aria-hidden="true">
    <img src={item.preview || item.posterUrl} alt="" loading="eager" decoding="async" draggable="false" />
  </span>;
  if (item.url) return <span className="overlay-scene-preview overlay-wallpaper-preview" aria-hidden="true">
    <WallpaperMedia src={item.url} mimeType={item.mimeType} posterUrl={item.posterUrl} preview loading="lazy" decoding="async"/>
  </span>;
  return <span className="overlay-scene-preview" style={{ background:item.color }} aria-hidden="true" />;
}

const themeCategories = ["solid", "illustrated", "mine"];
const getThemeCategory = theme => isOfficialWallpaperTheme(theme) ? "solid" : isCommunityWallpaperTheme(theme) ? "illustrated" : isWallpaperTheme(theme) ? "mine" : "solid";

export function ThemePanel({
  theme,
  themeSource = 'color',
  onTheme,
  appearance = 'system',
  resolvedAppearance = 'light',
  onAppearance,
  spaceColor = '#f2f7ff',
  onSpaceColor,
  frameTint = 50,
  onFrameTint,
  frameClear = false,
  onFrameClear,
  wallpaperLibrary,
  onUploadWallpaper,
  onClose,
  showShortcuts,
  onShortcuts,
  showPromotion,
  onPromotion,
  largeTabRadius = true,
  onLargeTabRadius,
  pageWidth = 'standard',
  onPageWidth,
  onAutoArrange,
  selectedAppIcon = 0,
  onAppIcon,
  onDefaultBrowserUnlock,
  openThemesRequest = 0,
}) {
  const [view, setView] = useState(openThemesRequest ? "themes" : "settings");
  const [paletteOverrides] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tabbit-glass-palette-v2') || '{}');
      return Object.fromEntries(Object.entries(saved).filter(([name, color]) => spaceColors.some(item => item.name === name) && /^#[0-9a-f]{6}$/i.test(color)));
    } catch { return {}; }
  });
  const palette = spaceColors.map(item => ({ ...item, value:paletteOverrides[item.name] || item.tintColor }));
  const gallerySelected = themeSource === 'gallery';
  const selectedSwatchIndex = gallerySelected ? -1 : palette.findIndex(item => item.value.toLowerCase() === spaceColor.toLowerCase());
  const selectedSwatchColor = palette[selectedSwatchIndex]?.color || spaceColor;
  const selectedAppIconPosition = Math.max(0, APP_ICON_OPTIONS.indexOf(selectedAppIcon));
  const [category, setCategory] = useState(getThemeCategory(theme));
  const { wallpapers = [], loading = false, uploading = false, deletingId = null, error = "" } = wallpaperLibrary || {};
  const selectedGalleryTheme = gallerySelected && (getBundledWallpaper(theme) || wallpapers.find(item => item.id === theme));
  const [wallpaperToDelete, setWallpaperToDelete] = useState(null);
  const keepMineAfterDeleteRef = useRef(false);
  const wallpaperUploadRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const panelId = useId();
  const themeEntryRef = useRef(null);
  const backRef = useRef(null);
  const settingsRef = useRef(null);
  const previousViewRef = useRef(null);
  const tabRefs = useRef([]);
  const galleryRef = useRef(null);
  const themeGridRef = useRef(null);
  const selectedThemeRef = useRef(null);
  const revealedThemeRef = useRef(null);
  const [themeSelectionRect, setThemeSelectionRect] = useState(null);

  useLayoutEffect(() => {
    if (openThemesRequest) setView('themes');
  }, [openThemesRequest]);


  useEffect(() => {
    if (keepMineAfterDeleteRef.current) {
      keepMineAfterDeleteRef.current = false;
      return;
    }
    selectCategory(getThemeCategory(theme));
  }, [theme]);

  useLayoutEffect(() => {
    if (view === "themes") {
      tabRefs.current[themeCategories.indexOf(getThemeCategory(theme))]?.focus({ preventScroll: true });
    } else if (previousViewRef.current === "themes") {
      themeEntryRef.current?.focus({ preventScroll: true });
    } else {
      themeEntryRef.current?.focus({ preventScroll: true });
    }
    previousViewRef.current = view;
  }, [view]);

  useLayoutEffect(() => {
    if (view !== "themes") { revealedThemeRef.current = null; return; }
    const gallery = galleryRef.current;
    const grid = themeGridRef.current;
    if (!gallery || !grid || !selectedThemeRef.current) return;
    let layoutFrame = null;
    let revealFrame = null;

    function revealSelectedTheme() {
      revealFrame = null;
      const selected = selectedThemeRef.current;
      if (!selected || !grid.contains(selected) || gallery.clientHeight === 0) return;
      // Returning to a category keeps its own scroll position. Only a newly
      // selected theme (or reopening the gallery) needs to be revealed.
      if (revealedThemeRef.current === theme) return;
      revealedThemeRef.current = theme;
      const box = gallery.getBoundingClientRect();
      const target = selected.getBoundingClientRect();
      const viewportTop = box.top + gallery.clientTop;
      const viewportBottom = viewportTop + gallery.clientHeight;
      if (target.top < viewportTop + 4 || target.bottom > viewportBottom - 4) {
        gallery.scrollTop += target.top - viewportTop - (gallery.clientHeight - target.height) / 2;
      }
    }

    function scheduleReveal() {
      if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
      if (revealFrame !== null) cancelAnimationFrame(revealFrame);
      revealFrame = null;
      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = null;
        // Wait for the final scroll range after the sidebar and grid resize.
        revealFrame = requestAnimationFrame(revealSelectedTheme);
      });
    }

    // Observe layout only so manual scrolling never pulls the user back.
    const observer = new ResizeObserver(scheduleReveal);
    observer.observe(gallery);
    observer.observe(grid);
    scheduleReveal();
    return () => {
      observer.disconnect();
      if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
      if (revealFrame !== null) cancelAnimationFrame(revealFrame);
    };
  }, [view, category, theme]);

  useLayoutEffect(() => {
    const grid = themeGridRef.current;
    const card = grid?.querySelector('.overlay-official-theme-card[aria-pressed="true"]');
    if (view !== "themes" || !grid || !card) { setThemeSelectionRect(null); return; }
    const measure = () => {
      const container = grid.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      setThemeSelectionRect({ x:box.left-container.left, y:box.top-container.top, width:box.width, height:box.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    observer.observe(card);
    measure();
    return () => observer.disconnect();
  }, [view, category, theme, gallerySelected, wallpapers.length, officialThemes]);

  const themeSelection = themeSelectionRect && <span
    className="overlay-official-theme-selection"
    style={{
      "--official-selection-x": `${themeSelectionRect.x}px`,
      "--official-selection-y": `${themeSelectionRect.y}px`,
      "--official-selection-width": `${themeSelectionRect.width}px`,
      "--official-selection-height": `${themeSelectionRect.height}px`,
    }}
    aria-hidden="true"
  />;

  function onTabKeyDown(event, index) {
    const next = event.key === "ArrowRight" ? (index + 1) % themeCategories.length
      : event.key === "ArrowLeft" ? (index + themeCategories.length - 1) % themeCategories.length
      : event.key === "Home" ? 0 : event.key === "End" ? themeCategories.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    selectCategory(themeCategories[next]);
    tabRefs.current[next]?.focus();
  }

  function selectCategory(nextCategory) {
    if (nextCategory !== category) setCategory(nextCategory);
  }

  async function onWallpaperUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadWallpaper || uploading || loading) return;
    await onUploadWallpaper(file);
  }

  async function confirmWallpaperDelete() {
    if (!wallpaperToDelete || deletingId) return;
    keepMineAfterDeleteRef.current = wallpaperToDelete.id === theme;
    const removed = await wallpaperLibrary.remove(wallpaperToDelete.id);
    if (!removed) keepMineAfterDeleteRef.current = false;
    setWallpaperToDelete(null);
    if (removed) requestAnimationFrame(() => wallpaperUploadRef.current?.focus({ preventScroll: true }));
  }

  function openThemes() {
    selectCategory(getThemeCategory(theme));
    setView("themes");
  }

  return (
    <section
      id="theme-settings-panel"
      className="theme-panel"
      data-selected-theme={theme}
      aria-label="自定义 Tabbit"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && view !== "settings") {
          event.preventDefault();
          event.stopPropagation();
          setView("settings");
        }
      }}
    >
      <div className="overlay-panel-pages" data-view={view}>
        <div className="overlay-panel-page overlay-panel-page-settings" aria-hidden={view !== "settings"} inert={view !== "settings"}>
          <div className="overlay-panel-heading">
            <h2>自定义 Tabbit</h2>
            <button className="overlay-icon-button overlay-panel-close" type="button" aria-label="关闭主题设置" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        <div ref={settingsRef} className="overlay-customize-settings">
          <section className="overlay-settings-group overlay-appearance-group" aria-labelledby={`${panelId}-appearance-heading`}>
            <div className="overlay-appearance-heading">
              <h3 id={`${panelId}-appearance-heading`}>主题外观</h3>
              {gallerySelected && <span className="overlay-theme-appearance-hint">随图片切换</span>}
            </div>
            <div className="overlay-appearance-options" role="group" aria-label="主题外观">
              {[
                { value:'system', label:'自动', image:'/personalized-home-2-0/asset/images/appearance-auto.webp' },
                { value:'light', label:'浅色', image:'/personalized-home-2-0/asset/images/appearance-light.webp' },
                { value:'dark', label:'深色', image:'/personalized-home-2-0/asset/images/appearance-dark.webp' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`overlay-preview-choice is-${option.value}`}
                  aria-pressed={appearance === option.value}
                  disabled={gallerySelected}
                  onClick={() => onAppearance?.(option.value)}
                >
                  <img className="overlay-preview-image" src={option.image} alt="" width="186" height="108" draggable="false" />
                  <span className="overlay-preview-choice-label"><span className="overlay-choice-radio" aria-hidden="true" />{option.label}</span>
                </button>
              ))}
            </div>
            <div className="overlay-settings-card overlay-space-colors" role="group" aria-label="空间主题">
              {palette.map(({name:label,color,value:colorValue,tint,darkTint}) => {
                const selected = !gallerySelected && spaceColor.toLowerCase() === colorValue.toLowerCase();
                return <button key={label} type="button" className="overlay-space-swatch" style={{ '--space-swatch':color }} aria-label={`空间颜色：${label}`} title={label} aria-pressed={selected} onClick={() => onSpaceColor?.(colorValue, { tint:resolvedAppearance === 'dark' ? darkTint : tint, clear:false, preset:true })}/>;
              })}
              <button ref={themeEntryRef} type="button" className="overlay-space-swatch overlay-gallery-swatch" style={{ '--space-swatch':'var(--nine-color-action-primary)' }} aria-label={`更多主题，查看全部 ${officialThemes.length + communityThemes.length + wallpapers.length} 款主题`} title="更多主题" aria-pressed={gallerySelected} onClick={openThemes}>
                {selectedGalleryTheme ? <span className="overlay-gallery-swatch-preview"><GalleryPreview item={selectedGalleryTheme}/></span> : <ImagePlus size={18} />}
              </button>
            </div>
          </section>
          <fieldset className="overlay-settings-group overlay-frame-settings" disabled={gallerySelected} aria-labelledby={`${panelId}-glass-heading`}>
            <div className="overlay-settings-group-heading">
              <h3 id={`${panelId}-glass-heading`}>主框架效果</h3>
              <button
                type="button"
                className="overlay-frame-reset"
                aria-label="重置主框架效果"
                title="重置主框架效果"
                onClick={() => {
                  const defaultTint = selectedSwatchIndex === 0 ? 10 : resolvedAppearance === 'dark' ? 20 : 70;
                  onFrameTint?.(defaultTint, { clear:false, preset:true, reset:true });
                }}
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="overlay-settings-card overlay-frame-card" style={{ '--overlay-space-color':selectedSwatchColor }}>
              <SettingSegments
                label="玻璃材质"
                value={frameClear ? 'clear' : 'regular'}
                disabled={gallerySelected}
                options={[{ value:'regular', label:'标准' }, { value:'clear', label:'通透' }]}
                onChange={value => onFrameClear?.(value === 'clear')}
              />
              <div className="overlay-frame-divider" aria-hidden="true" />
              <div className="overlay-opacity-setting">
                <label className="overlay-setting-label" htmlFor={`${panelId}-opacity`}>浓度</label>
                <div className="overlay-range-control" style={{
                  "--overlay-range-value": `${frameTint}%`,
                  "--overlay-range-negative-value": `${-frameTint}%`,
                  "--overlay-range-edge-correction": `${frameTint * 0.04}px`,
                }}>
                  <input
                    id={`${panelId}-opacity`}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={frameTint}
                    onChange={event => onFrameTint?.(Number(event.target.value))}
                    aria-label="主框架染色浓度"
                    aria-valuetext={`${frameTint}%`}
                  />
                  <span className="overlay-range-thumb" aria-hidden="true" />
                </div>
              </div>
            </div>
          </fieldset>
          <section className="overlay-settings-group" aria-labelledby={`${panelId}-layout-heading`}>
            <h3 id={`${panelId}-layout-heading`}>布局</h3>
            <div className="overlay-settings-card overlay-layout-card">
              <label className="overlay-setting-row overlay-toggle-row">
                <span className="overlay-setting-label">超宽模式</span>
                <input type="checkbox" checked={pageWidth === 'wide'} onChange={event => onPageWidth?.(event.target.checked ? 'wide' : 'standard')} aria-label="超宽模式" />
                <span className="overlay-toggle-track" aria-hidden="true" />
              </label>
              <div className="overlay-layout-divider" aria-hidden="true" />
              <label className="overlay-setting-row overlay-toggle-row">
                <span className="overlay-setting-label">标签页大圆角</span>
                <input type="checkbox" checked={largeTabRadius} onChange={event => onLargeTabRadius?.(event.target.checked)} aria-label="标签页大圆角" />
                <span className="overlay-toggle-track" aria-hidden="true" />
              </label>
              <div className="overlay-layout-divider" aria-hidden="true" />
              <label className="overlay-setting-row overlay-toggle-row">
                <span className="overlay-setting-label">快捷方式与小组件</span>
                <input type="checkbox" checked={Boolean(showShortcuts)} onChange={event => onShortcuts?.(event.target.checked)} aria-label="显示快捷方式与小组件" />
                <span className="overlay-toggle-track" aria-hidden="true" />
              </label>
              <div className="overlay-layout-divider" aria-hidden="true" />
              <div className="overlay-setting-row overlay-layout-action-row">
                <span className="overlay-setting-label">一键整理卡片</span>
                <button type="button" className="overlay-layout-text-action" disabled={!showShortcuts} onClick={onAutoArrange}>整理</button>
              </div>
              <div className="overlay-layout-divider" aria-hidden="true" />
              <label className="overlay-setting-row overlay-toggle-row">
                <span className="overlay-setting-label">活动卡片</span>
                <input type="checkbox" checked={Boolean(showPromotion)} onChange={event => onPromotion?.(event.target.checked)} aria-label="显示活动卡片" />
                <span className="overlay-toggle-track" aria-hidden="true" />
              </label>
            </div>
          </section>
          <section className="overlay-settings-group" aria-labelledby={`${panelId}-app-icons-heading`}>
            <div className="overlay-settings-group-heading overlay-app-icon-heading">
              <h3 id={`${panelId}-app-icons-heading`}>应用图标</h3>
              <button type="button" className="overlay-app-icon-unlock" onClick={onDefaultBrowserUnlock}>
                <span><span className="overlay-app-icon-unlock-action" style={{ color:gallerySelected ? undefined : palette[selectedSwatchIndex]?.linkColor }}>设置为默认浏览器</span>，即可解锁</span>
              </button>
            </div>
            <div className="overlay-app-icon-placeholders" aria-label="应用图标">
              <span className="overlay-app-icon-selection-card" style={{ '--app-icon-column':selectedAppIconPosition % 5, '--app-icon-row':Math.floor(selectedAppIconPosition / 5) }} aria-hidden="true" />
              {APP_ICON_OPTIONS.map((index, position) => (
                <button key={index} type="button" className="overlay-app-icon-placeholder" aria-label={`应用图标 ${position + 1}`} aria-pressed={selectedAppIcon === index} onClick={() => onAppIcon?.(index)}>
                  <span className="overlay-app-icon-image-frame">
                    <img className="overlay-app-icon-image" src={`/personalized-home-2-0/asset/images/app-icons/${index + 1}.webp`} alt="" width="200" height="200" draggable="false" />
                  </span>
                  <span className="overlay-app-icon-selected" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </div>
        </div>
        <div className="overlay-panel-page overlay-panel-page-themes" aria-hidden={view !== "themes"} inert={view !== "themes"}>
          <div className="overlay-panel-heading is-subpage">
            <div className="overlay-subpage-leading">
              <button ref={backRef} className="overlay-icon-button overlay-panel-back" type="button" aria-label="返回自定义设置" onClick={() => setView("settings")}>
                <ChevronLeft size={16} />
              </button>
              <h2 className="overlay-subpage-title">更多主题</h2>
            </div>
            <button className="overlay-icon-button overlay-panel-close" type="button" aria-label="关闭主题设置" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        <div className="overlay-theme-page">
          <div className="overlay-theme-tabs" data-category={category} role="tablist" aria-label="主题类型">
            {[
              { id: "solid", label: "官方", count: officialThemes.length },
              { id: "illustrated", label: "社区", count: communityThemes.length },
              { id: "mine", label: "我的", count: wallpapers.length },
            ].map((tab, index) => (
              <button
                type="button"
                key={tab.id}
                role="tab"
                id={`${panelId}-${tab.id}-tab`}
                aria-controls={`${panelId}-${tab.id}-panel`}
                aria-selected={category === tab.id}
                tabIndex={category === tab.id ? 0 : -1}
                ref={(element) => { tabRefs.current[index] = element; }}
                onClick={() => selectCategory(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                {tab.label}<span>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="overlay-theme-browser-stack">
            {[
              { id:"solid", label:"官方主题", items:officialThemes },
              { id:"illustrated", label:"社区主题", items:communityThemes },
            ].map(({ id, label, items }) => <div key={id} className="overlay-theme-browser" data-active={category === id} ref={category === id ? galleryRef : null}
              role="tabpanel" id={`${panelId}-${id}-panel`} aria-labelledby={`${panelId}-${id}-tab`}
              aria-hidden={category !== id} inert={category !== id}>
              <div ref={category === id ? themeGridRef : null} className="overlay-official-theme-grid" aria-label={label}>
                {category === id && themeSelection}
                {items.map(item => (
                  <button
                    key={item.id}
                    ref={element => { if (category === id && item.id === theme) selectedThemeRef.current = element; }}
                    type="button"
                    className="overlay-official-theme-card"
                    aria-pressed={gallerySelected && item.id === theme}
                    onClick={() => onTheme(item.id)}
                  >
                    <span className="overlay-official-theme-cover">
                      <GalleryPreview item={item}/>
                    </span>
                    <span className="overlay-official-theme-title">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>)}
            <div className="overlay-theme-browser" data-active={category === "mine"} ref={category === "mine" ? galleryRef : null}
              role="tabpanel" id={`${panelId}-mine-panel`} aria-labelledby={`${panelId}-mine-tab`}
              aria-hidden={category !== "mine"} inert={category !== "mine"}>
                <div ref={category === "mine" ? themeGridRef : null} className="overlay-scene-grid" aria-label="我的壁纸">
                  {category === "mine" && themeSelection}
                  <div className="overlay-wallpaper-item">
                    <button
                      ref={wallpaperUploadRef}
                      type="button"
                      className="overlay-official-theme-card overlay-wallpaper-upload"
                      aria-label="上传图片或视频壁纸"
                      aria-disabled={uploading || loading}
                      onClick={() => { if (!uploading && !loading) wallpaperInputRef.current?.click(); }}
                    >
                      <span className="overlay-scene-image-wrap">
                        <span className="overlay-wallpaper-upload-surface"><span className="iconfont icon-jiantou_fenxiang_shangchuan" aria-hidden="true"/></span>
                      </span>
                      <span className="overlay-official-theme-title">自定义壁纸</span>
                    </button>
                    <input ref={wallpaperInputRef} hidden type="file" accept={WALLPAPER_ACCEPT} onChange={onWallpaperUpload}/>
                  </div>
                  {wallpapers.map(item => {
                    const selected = gallerySelected && item.id === theme;
                    const stored = isWallpaperTheme(item.id);
                    return <div className="overlay-wallpaper-item" key={item.id}>
                      <button
                        ref={element => { if (category === "mine" && selected) selectedThemeRef.current = element; }}
                        type="button"
                        className="overlay-official-theme-card"
                        aria-pressed={selected}
                        onClick={() => onTheme(item.id)}
                      >
                        <span className="overlay-official-theme-cover">
                          <GalleryPreview item={item}/>
                        </span>
                        <span className="overlay-official-theme-title">{item.name}</span>
                      </button>
                      {stored && <button
                        type="button"
                        className="overlay-wallpaper-delete"
                        aria-label={`删除壁纸“${item.name}”`}
                        disabled={Boolean(deletingId)}
                        onClick={() => setWallpaperToDelete(item)}
                      ><Trash2 size={14}/></button>}
                    </div>;
                  })}
                </div>
                {error && <p className="overlay-wallpaper-error" role="status">{error}</p>}
            </div>
          </div>
        </div>
        </div>
      </div>
      {wallpaperToDelete && <BoardConfirm title={`删除壁纸“${wallpaperToDelete.name}”？`} description="仅从我的壁纸中移除，电脑中的原始图片不会被删除。" busy={Boolean(deletingId)} confirmLabel={deletingId ? "正在删除…" : "删除壁纸"} onClose={() => { if (!deletingId) setWallpaperToDelete(null); }} onConfirm={confirmWallpaperDelete} />}
    </section>
  );
}
