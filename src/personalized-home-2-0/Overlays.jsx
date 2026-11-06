/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ImagePlus,
  ListChecks,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Trash2,
  X,
} from "./icons";
import { illustratedThemes } from "./themes/catalog";
import { monochromeThemes } from "./themes/monochrome-themes";
import { scrollThemes } from "./themes/scroll-themes";
import { scrollThemePreview } from "./themes/scroll-theme-renderers";
import { oceanTheme, isOceanTheme } from './themes/ocean/catalog.js';
import { isWallpaperTheme, WALLPAPER_ACCEPT } from "./themes/wallpapers";
import { exampleWallpapers, isExampleWallpaperTheme } from "./themes/exampleWallpapers";
import WallpaperImage from "./themes/WallpaperImage";
import { BoardConfirm } from "./board/BoardDialogs";
import SettingSegments from "./SettingSegments";
import PreviewStack, { PreviewStackItem } from "./PreviewStack";
import "./overlays.css";
import { spaceColors } from '../spaceColors';

const themes = [
  { id: "light", label: "白昼（默认）", color: "#ffffff" },
  { id: "cream", label: "暖砂", color: "#f5f1e9" },
  { id: "mint", label: "薄荷", color: "#edf5f0" },
  { id: "dark", label: "深夜", color: "#191a1c" },
  ...monochromeThemes,
  ...scrollThemes,
];
const officialThemes = themes.slice(0, 5);

function ScrollThemePreview({ item }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let current = true;
    scrollThemePreview(item).then(url => { if (current) setSource(url); });
    return () => { current = false; };
  }, [item]);
  return (
    <span className="overlay-scene-preview overlay-scroll-theme-preview" data-pixel={item.pixel ? "true" : undefined} style={{ backgroundColor: item.color }} aria-hidden="true">
      {source && <img src={source} alt="" />}
    </span>
  );
}

const communityThemes = [oceanTheme, ...exampleWallpapers, ...illustratedThemes];
const featuredThemes = ['scene-05', 'scene-12', 'scene-33', 'scene-32', 'scene-40']
  .map(id => illustratedThemes.find(item => item.id === id));

function ScenePreview({ item }) {
  const [unavailable, setUnavailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const number = item.id.replace(/^scene-/, "").padStart(2, "0");

  return (
    <span
      className={`overlay-scene-preview ${loaded ? "is-loaded" : ""}`}
      style={{ "--scene-preview-color": item.scene?.bg || "#e9e5dc" }}
      aria-hidden="true"
    >
      <span className="overlay-scene-fallback">
        <span className="overlay-scene-sun" />
        <span className="overlay-scene-hills" />
      </span>
      {!unavailable && (
        <img
          src={`/personalized-home-2-0/asset/themes/previews/${number}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setUnavailable(true)}
        />
      )}
    </span>
  );
}

const themeCategories = ["solid", "illustrated", "mine"];
const getThemeCategory = (theme) => isWallpaperTheme(theme) ? "mine"
  : isOceanTheme(theme) || isExampleWallpaperTheme(theme) || theme?.startsWith("scene-") ? "illustrated" : "solid";

export function ThemePanel({
  theme,
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
  showShortcutLabels,
  onShortcutLabels,
  showPromotion,
  onPromotion,
  promotionStyle = "card",
  onPromotionStyle,
  liquidGlass = false,
  onLiquidGlass,
  liquidGlassOpacity = 50,
  onLiquidGlassOpacity,
  wallpaperBlur = false,
  onWallpaperBlur,
  shortcutShape = "circle",
  onShortcutShape,
  shortcutSize = "medium",
  onShortcutSize,
  pageWidth = "standard",
  onPageWidth,
  largeTabRadius = true,
  onLargeTabRadius,
  onAddContent,
  selectedAppIcon = 0,
  onAppIcon,
  pageManagement,
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
  const selectedSwatchIndex = palette.findIndex(item => item.value.toLowerCase() === spaceColor.toLowerCase());
  const selectedSwatchColor = palette[selectedSwatchIndex]?.color || spaceColor;
  const selectedOfficialThemeIndex = Math.max(0, officialThemes.findIndex(item => item.id === theme));
  const [category, setCategory] = useState(getThemeCategory(theme));
  const [categoryDirection, setCategoryDirection] = useState(1);
  const { wallpapers = [], loading = false, uploading = false, deletingId = null, error = "" } = wallpaperLibrary || {};
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
  const officialGridRef = useRef(null);
  const officialCardRefs = useRef([]);
  const [officialSelectionRect, setOfficialSelectionRect] = useState(null);

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
    if (view !== "themes") return;
    const gallery = galleryRef.current;
    const grid = themeGridRef.current;
    if (!gallery || !grid || !selectedThemeRef.current) return;
    let layoutFrame = null;
    let revealFrame = null;

    function revealSelectedTheme() {
      revealFrame = null;
      const selected = selectedThemeRef.current;
      if (!selected || gallery.clientHeight === 0) return;
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
    if (view !== "themes" || category !== "solid") return;
    const grid = officialGridRef.current;
    const card = officialCardRefs.current[selectedOfficialThemeIndex];
    if (!grid || !card) return;
    const measure = () => setOfficialSelectionRect({ x:card.offsetLeft, y:card.offsetTop, width:card.offsetWidth, height:card.offsetHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    observer.observe(card);
    measure();
    return () => observer.disconnect();
  }, [view, category, theme, selectedOfficialThemeIndex]);

  function onTabKeyDown(event, index) {
    const next = event.key === "ArrowRight" ? (index + 1) % themeCategories.length
      : event.key === "ArrowLeft" ? (index + themeCategories.length - 1) % themeCategories.length
      : event.key === "Home" ? 0 : event.key === "End" ? themeCategories.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    selectCategory(themeCategories[next], event.key === "ArrowLeft" ? -1 : 1);
    tabRefs.current[next]?.focus();
  }

  function selectCategory(nextCategory, forcedDirection) {
    if (nextCategory === category) return;
    const currentIndex = themeCategories.indexOf(category);
    const nextIndex = themeCategories.indexOf(nextCategory);
    setCategoryDirection(forcedDirection ?? (nextIndex >= currentIndex ? 1 : -1));
    setCategory(nextCategory);
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
            <h3 id={`${panelId}-appearance-heading`}>主题外观</h3>
            <div className="overlay-appearance-options" role="group" aria-label="主题外观">
              {[
                { value:'system', label:'自动', image:'/personalized-home-2-0/asset/images/appearance-auto.png' },
                { value:'light', label:'浅色', image:'/personalized-home-2-0/asset/images/appearance-light.png' },
                { value:'dark', label:'深色', image:'/personalized-home-2-0/asset/images/appearance-dark.png' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`overlay-preview-choice is-${option.value}`}
                  aria-pressed={appearance === option.value}
                  onClick={() => onAppearance?.(option.value)}
                >
                  <img className="overlay-preview-image" src={option.image} alt="" width="186" height="108" draggable="false" />
                  <span className="overlay-preview-choice-label"><span className="overlay-choice-radio" aria-hidden="true" />{option.label}</span>
                </button>
              ))}
            </div>
            <div className="overlay-settings-card overlay-space-colors" role="group" aria-label="空间颜色">
              {palette.map(({name:label,color,value:colorValue,tint,darkTint}) => {
                const selected = spaceColor.toLowerCase() === colorValue;
                return <button key={label} type="button" className="overlay-space-swatch" style={{ '--space-swatch':color }} aria-label={`空间颜色：${label}`} title={label} aria-pressed={selected} onClick={() => onSpaceColor?.(colorValue, { tint:resolvedAppearance === 'dark' ? darkTint : tint, clear:false, preset:true })}/>;
              })}
            </div>
            <div className="overlay-settings-card">
              <button ref={themeEntryRef} type="button" className="overlay-setting-row overlay-theme-entry preview-stack-trigger" aria-label={`更多主题，查看全部 ${themes.length + communityThemes.length + wallpapers.length} 款主题`} onClick={openThemes}>
                <span className="overlay-setting-label">更多主题</span>
                <span className="overlay-theme-teaser" aria-hidden="true">
                  <PreviewStack as="span" className="overlay-theme-stack">
                    {featuredThemes.map((item, index) => <PreviewStackItem as="span" key={item.id} className="overlay-theme-stack-card" title={item.name} tilt={[-7, 4, -4, 5, -3][index]}><ScenePreview item={item} /></PreviewStackItem>)}
                  </PreviewStack>
                  <ChevronRight size={14} />
                </span>
              </button>
            </div>
          </section>
          <section className="overlay-settings-group" aria-labelledby={`${panelId}-glass-heading`}>
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
          </section>
          <section className="overlay-settings-group" aria-labelledby={`${panelId}-layout-heading`}>
            <h3 id={`${panelId}-layout-heading`}>布局</h3>
            <div className="overlay-settings-card overlay-layout-card">
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
              <label className="overlay-setting-row overlay-toggle-row">
                <span className="overlay-setting-label">活动卡片</span>
                <input type="checkbox" checked={Boolean(showPromotion)} onChange={event => onPromotion?.(event.target.checked)} aria-label="显示活动卡片" />
                <span className="overlay-toggle-track" aria-hidden="true" />
              </label>
            </div>
          </section>
          <section className="overlay-settings-group" aria-labelledby={`${panelId}-app-icons-heading`}>
            <h3 id={`${panelId}-app-icons-heading`}>应用图标</h3>
            <div className="overlay-app-icon-placeholders" aria-label="应用图标">
              <span className="overlay-app-icon-selection-card" style={{ '--app-icon-column':selectedAppIcon % 5, '--app-icon-row':Math.floor(selectedAppIcon / 5) }} aria-hidden="true" />
              {Array.from({ length:10 }, (_, index) => (
                <button key={index} type="button" className="overlay-app-icon-placeholder" aria-label={`应用图标 ${index + 1}`} aria-pressed={selectedAppIcon === index} onClick={() => onAppIcon?.(index)}>
                  <span className="overlay-app-icon-image-frame">
                    <img className="overlay-app-icon-image" src={`/personalized-home-2-0/asset/images/app-icons/${index + 1}.png`} alt="" width="200" height="200" draggable="false" />
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
              { id: "illustrated", label: "社区", count: 0 },
              { id: "mine", label: "我的", count: 0 },
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
          <div
            className="overlay-theme-browser"
            ref={galleryRef}
            role="tabpanel"
            id={`${panelId}-${category}-panel`}
            aria-labelledby={`${panelId}-${category}-tab`}
          >
            {category === "solid" && (
              <div ref={officialGridRef} className="overlay-official-theme-grid" aria-label="官方主题">
                {officialSelectionRect && <span
                  className="overlay-official-theme-selection"
                  style={{
                    "--official-selection-x": `${officialSelectionRect.x}px`,
                    "--official-selection-y": `${officialSelectionRect.y}px`,
                    "--official-selection-width": `${officialSelectionRect.width}px`,
                    "--official-selection-height": `${officialSelectionRect.height}px`,
                  }}
                  aria-hidden="true"
                />}
                {officialThemes.map((item, index) => (
                  <button
                    key={item.id}
                    ref={element => { officialCardRefs.current[index] = element; }}
                    type="button"
                    className="overlay-official-theme-card"
                    aria-pressed={selectedOfficialThemeIndex === index}
                    onClick={() => onTheme(item.id)}
                  >
                    <span className="overlay-official-theme-cover">
                      {item.renderer ? <ScrollThemePreview item={item} /> : item.preview ? <img src={item.preview} alt="" draggable="false" /> : <span className="overlay-official-theme-solid" style={{ "--official-theme-color":item.color }} />}
                    </span>
                    <span className="overlay-official-theme-title">{item.name || item.title || item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
      {wallpaperToDelete && <BoardConfirm title={`删除壁纸“${wallpaperToDelete.name}”？`} description="仅从我的壁纸中移除，电脑中的原始图片不会被删除。" confirmLabel={deletingId ? "正在删除…" : "删除壁纸"} onClose={() => { if (!deletingId) setWallpaperToDelete(null); }} onConfirm={confirmWallpaperDelete} />}
    </section>
  );
}

const invitationText =
  "邀请你一起体验 Tabbit，用 AI 开启更轻松的浏览。此文案仅用于个性化首页 2.0 交互演示，未生成真实邀请链接。";
const voiceExamples = [
  "帮我规划一个轻松的周末",
  "找一些简洁的首页设计灵感",
  "解释一下浏览器里的 AI 能做什么",
];

export function DemoDialog({
  kind,
  promotion,
  onClose,
  query = "",
  mode = "对话",
  model = "Auto",
  reference = "",
  attachments = [],
  taskContext = null,
  skill = null,
  returnLabel = '返回首页',
  onUsePrompt,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [copyStatus, setCopyStatus] = useState("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    setCopyStatus("idle");
  }, [kind]);

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  function selectVoiceExample(text) {
    onUsePrompt?.(text);
    onClose();
  }

  const resultContent = mode === "任务"
    ? {
        Icon: ListChecks,
        label: "任务规划",
        text: "在这里可以描述目标并继续安排任务。当前演示未连接真实 AI，也不会执行实际操作。",
      }
    : {
        Icon: MessageSquare,
        label: "AI 对话",
        text: "在这里可以围绕你的问题继续交流。当前演示未连接真实 AI，暂时不会生成回答；你也可以打开网页搜索继续探索。",
      };
  const ResultIcon = resultContent.Icon;

  return (
    <dialog
      ref={dialogRef}
      className={`demo-dialog overlay-dialog-${kind}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-dialog-inner">
        <button
          className={promotion ? "promotion-close overlay-promotion-close" : "overlay-icon-button overlay-dialog-close"}
          type="button"
          aria-label="关闭弹窗"
          onClick={onClose}
          autoFocus
        >
          <X size={promotion ? 16 : 19} />
        </button>

        {promotion && (
          <>
            <img
              className="overlay-promotion-image"
              src={promotion.image}
              alt={promotion.alt}
            />
            <div className={`overlay-dialog-content${kind === "invite" ? "" : " overlay-promotion-content"}`}>
              <span className="overlay-eyebrow">{promotion.dialogEyebrow}</span>
              <h2 id={titleId}>{promotion.title}</h2>
              <p className="overlay-dialog-description">
                {promotion.description.replace(/[。.]$/, "")}。
              </p>
              <div className="overlay-promotion-detail">{kind === "invite" ? invitationText : promotion.dialogNote}</div>
              {kind === "invite" ? <>
              <button
                className="overlay-primary-button"
                type="button"
                onClick={copyInvitation}
              >
                {copyStatus === "copied" ? (
                  <Check size={17} />
                ) : (
                  <Copy size={16} />
                )}
                {copyStatus === "copied" ? "邀请文案已复制" : "复制邀请文案"}
              </button>
              <span className="overlay-copy-status" aria-live="polite">
                {copyStatus === "copied"
                  ? "复制成功，可以粘贴使用。"
                  : copyStatus === "error"
                    ? "复制失败，请手动选择并复制上方文案。"
                    : ""}
              </span>
              </> : <button className="overlay-primary-button" type="button" onClick={onClose}>
                知道了
              </button>}
            </div>
          </>
        )}

        {kind === "voice" && (
          <div className="overlay-dialog-content overlay-voice-content">
            <div className="overlay-dialog-symbol">
              <Mic size={25} strokeWidth={1.8} />
            </div>
            <h2 id={titleId}>把想法，说出来</h2>
            <p className="overlay-dialog-description">
              选择一句示例，体验语音内容填入搜索框的效果。
            </p>
            <p className="overlay-demo-note">
              示例体验 · 不使用麦克风，不录制声音
            </p>
            <div className="overlay-voice-examples">
              {voiceExamples.map((text) => (
                <button
                  type="button"
                  className="overlay-example-button"
                  key={text}
                  onClick={() => selectVoiceExample(text)}
                >
                  <span>{text}</span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "result" && (
          <div className="overlay-dialog-content overlay-result-content">
            <div className="overlay-dialog-symbol">
              <ResultIcon size={25} strokeWidth={1.8} />
            </div>
            <span className="overlay-eyebrow">
              {mode} · {resultContent.label}
            </span>
            <h2 id={titleId}>演示结果</h2>
            {skill && <p className="overlay-dialog-description">已使用妙招：{skill.name}</p>}
            <div className="overlay-query">
              <span>你的输入</span>
              <p>{query || "还没有输入内容"}</p>
            </div>
            <p className="overlay-selected-model">
              已选模型：<strong>{model}</strong>
            </p>
            {mode === "任务" && taskContext && (
              <div className="overlay-query">
                <span>任务挂载</span>
                <p>项目：{taskContext.project || "未选择"}<br />
                  {taskContext.runLocation === "local" && <>审批策略：{taskContext.approvalPolicy || "完全访问"}<br /></>}
                  运行位置：{taskContext.runLocation === "cloud" ? "在云端" : "在你的计算机上"}</p>
                <small>仅展示本次选择，尚未连接执行环境或授予文件访问权限。</small>
              </div>
            )}
            {reference.trim() && (
              <div className="overlay-query overlay-reference">
                <span>参考内容</span>
                <p>{reference}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="overlay-query overlay-attachments">
                <span>附件 · {attachments.length}</span>
                <ul>
                  {attachments.map((file) => (
                    <li key={file.id}>
                      <Paperclip size={14} aria-hidden="true" />
                      <span>{file.name}</span>
                    </li>
                  ))}
                </ul>
                <small>文件仅在本地预览，尚未上传或交给模型处理。</small>
              </div>
            )}
            <p className="overlay-dialog-description">{resultContent.text}</p>
            <p className="overlay-demo-note">未连接真实 AI / 文件服务</p>
            <a
              className="overlay-primary-button"
              href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              搜索网页
              <ExternalLink size={16} />
            </a>
            <button
              className="overlay-secondary-button"
              type="button"
              onClick={onClose}
            >
              {returnLabel}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
