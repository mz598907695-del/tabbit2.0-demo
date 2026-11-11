import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import AIWorkspace from './ai-workspace/AIWorkspace';
import { getHomeRoot } from "./home-host";
import HomeBackground from './HomeBackground';
import HomeContent from './HomeContent';
import { ComposerWeatherContext } from './ComposerWeather';
import HomeControls from './HomeControls';
import { brands, initialShortcutPages, promotions } from './home-data';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import WidgetAIChat from "./WidgetAIChat";
import { ThemePanel } from "./ThemePanel";
import { DemoDialog } from "./DemoDialog";
import PageContextMenu from "./PageContextMenu";
import PageManagerDialog from "./board/PageManagerDialog";
import ThemeSidebarResizeHandle from './ThemeSidebarResizeHandle';
import { resolvePreferences } from "./preferences";
import { spaceColors } from "../spaceColors";
import { normalizeAppIcon } from "./appIcons";
import { useBoardState, transferBoardItem, applyBoardPageChange } from "./board/state";
import { getIllustratedTheme } from "./themes/catalog";
import { getThemeBackground, getThemeSelectionAppearance } from "./themes/appearance";
import { isWallpaperTheme } from "./themes/wallpapers";
import { getExampleWallpaper } from "./themes/exampleWallpapers";
import { useWallpapers } from "./themes/useWallpapers";
import { applyLiquidGlassOpacity } from "./themes/liquidGlassMaterial";
import { useLiquidGlassLens } from "./themes/useLiquidGlassLens";
import { usePageSwipe } from "./usePageSwipe";
import { isOceanTheme, OCEAN_THEME_ID } from './themes/ocean/catalog.js';
import { baseGlassSettings, GLASS_THEME_EVENT, GLASS_SPACE_THEME_EVENT } from '../demoDefaults';
import { readWindowAppearance, resolveWindowAppearance, watchExistingTokenMode, WINDOW_APPEARANCE_KEY } from '../windowAppearance';
import { useSpaceWallpaperTransition } from './themes/useSpaceWallpaperTransition';
import { useSpaceAppearanceTransition } from './themes/useSpaceAppearanceTransition';
import { useWindowWallpaperLayout } from './themes/useWindowWallpaperLayout';
import { getAutomaticThemeAppearance } from './themes/imageAppearance';
import { COLOR_WINDOW_APPEARANCE_KEY, resolveThemeSource } from '../themeSelection';

function readPreferences() {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const preview = new URLSearchParams(window.location.search).get('preview') === OCEAN_THEME_ID;
  try {
    const saved = JSON.parse(localStorage.getItem("personalized-home-2-0-preferences") || "{}");
    return resolvePreferences(preview ? { ...resolvePreferences(saved, systemDark), theme: OCEAN_THEME_ID, appearance: 'light', liquidGlass: true, liquidGlassOpacity: 20, wallpaperBlur: false } : saved, systemDark);
  } catch {
    return resolvePreferences(preview ? { theme: OCEAN_THEME_ID, appearance: 'light', liquidGlass: true, liquidGlassOpacity: 20 } : {}, systemDark);
  }
}

export function App({ hostActive = true } = {}) {
  const [widgetAI, setWidgetAI] = useState(false);
  const [widgetAIVisited, setWidgetAIVisited] = useState(false);
  const [widgetAIEntryId, setWidgetAIEntryId] = useState('initial');
  const [widgetAIEntries, setWidgetAIEntries] = useState(() => [{ id: 'initial', draft: null }]);
  const [preferences, setPreferences] = useState(readPreferences);
  const [spaceId, setSpaceId] = useState(null);
  const spaceIdRef = useRef(null);
  const [spaceColor, setSpaceColor] = useState(baseGlassSettings.color);
  const controlColorPreset = spaceColors.find((item, index) => index > 0 && item.tintColor.toLowerCase() === spaceColor.toLowerCase());
  const controlAccent = preferences.themeSource === 'gallery' ? 'var(--nine-color-action-primary)' : controlColorPreset?.color || 'var(--nine-color-action-primary)';
  const checkboxAccent = preferences.themeSource === 'gallery' ? 'var(--nine-color-action-primary)' : controlColorPreset?.accentToken || 'var(--nine-color-action-primary)';
  const composerFrameColor = preferences.themeSource === 'color' && spaceColor.toLowerCase() !== baseGlassSettings.color.toLowerCase()
    ? controlColorPreset?.color || spaceColor : null;
  const [frameTint,setFrameTint] = useState(50);
  const [frameClear,setFrameClear] = useState(false);
  const [selectedAppIcon, setSelectedAppIcon] = useState(() => {
    const saved = Number.parseInt(localStorage.getItem('tabbit-app-icon-v1') || '0', 10);
    return normalizeAppIcon(saved);
  });
  const [windowAppearance, setWindowAppearance] = useState(() => {
    return readWindowAppearance();
  });
  const effectiveAppearance = preferences.themeSource === 'gallery' ? preferences.appearance : windowAppearance;
  const targetAppearanceTheme = resolveWindowAppearance(effectiveAppearance);
  const [appearanceTheme, setAppearanceTheme] = useState(() => targetAppearanceTheme);
  useLayoutEffect(() => {
    // Commit the image and its analyzed appearance together, before paint.
    localStorage.setItem(WINDOW_APPEARANCE_KEY, effectiveAppearance);
    return watchExistingTokenMode(effectiveAppearance, resolved => {
      setAppearanceTheme(resolved);
      void invoke('set_window_appearance', { appearance:effectiveAppearance, resolved }).catch(error => {
        console.warn('Native window appearance update unavailable:', error);
      });
    });
  }, [effectiveAppearance, preferences.theme]);
  useSpaceAppearanceTransition(spaceId, appearanceTheme);
  useEffect(() => {
    if (preferences.themeSource === 'color') localStorage.setItem(COLOR_WINDOW_APPEARANCE_KEY, windowAppearance);
  }, [windowAppearance, preferences.themeSource]);
  useEffect(() => {
    localStorage.setItem('tabbit-app-icon-v1', String(selectedAppIcon));
    void invoke('set_app_icon', { index:selectedAppIcon + 1 }).catch(error => {
      console.warn('App icon update unavailable:', error);
    });
  }, [selectedAppIcon]);
  useEffect(() => {
    const syncSpaceTheme = event => {
      if (typeof event.detail?.spaceId === 'string') {
        if (spaceIdRef.current !== event.detail.spaceId) themeSelectionEpoch.current += 1;
        spaceIdRef.current = event.detail.spaceId;
        setSpaceId(event.detail.spaceId);
      }
      const theme = event.detail?.theme;
      if (typeof theme === 'string') {
        const themeSource = resolveThemeSource(theme, event.detail.themeSource);
        setPreferences(current => {
          const savedAppearance = event.detail?.appearance;
          const appearance = themeSource === 'gallery' && ['light', 'dark'].includes(savedAppearance)
            ? savedAppearance : getThemeSelectionAppearance(theme, current.appearance);
          return current.theme === theme && current.themeSource === themeSource && current.appearance === appearance
            ? current : { ...current, theme, themeSource, appearance };
        });
        // Stored space appearance can predate the current image/threshold.
        // Gallery appearance is owned by image analysis and must not be reset
        // by a later settings sync for the same theme.
        if (themeSource === 'color') {
          const mode = localStorage.getItem(COLOR_WINDOW_APPEARANCE_KEY) || 'system';
          if (['system', 'light', 'dark'].includes(mode)) setWindowAppearance(mode);
        }
      }
      if (typeof event.detail?.color === 'string') setSpaceColor(event.detail.color);
      if (typeof event.detail?.tint === 'number') setFrameTint(event.detail.tint);
      if (typeof event.detail?.clear === 'boolean') setFrameClear(event.detail.clear);
    };
    window.addEventListener(GLASS_SPACE_THEME_EVENT,syncSpaceTheme);
    return () => window.removeEventListener(GLASS_SPACE_THEME_EVENT,syncSpaceTheme);
  }, []);
  useLiquidGlassLens(preferences.liquidGlass && preferences.shortcuts && !widgetAI);
  const wallpaperLibrary = useWallpapers();
  const selectedWallpaper = getExampleWallpaper(preferences.theme)
    || wallpaperLibrary.wallpapers.find((item) => item.id === preferences.theme);
  const wallpaperTransition = useSpaceWallpaperTransition(preferences.theme, selectedWallpaper,
    wallpaperLibrary.wallpapers, targetAppearanceTheme, preferences.wallpaperBlur, spaceId);
  // When a manual selection crosses appearances, enter the destination UI
  // immediately. Its neutral base sits behind the new wallpaper while media
  // becomes drawable and fades in, so old light/dark artwork never conflicts
  // with the destination surfaces.
  const surfaceAppearanceTheme = wallpaperTransition?.kind === 'selection'
    ? wallpaperTransition.to.appearance || appearanceTheme : appearanceTheme;
  const [composerOpen, setComposerOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themePanelPresent, setThemePanelPresent] = useState(false);
  useEffect(() => {
    if (themeOpen) { setThemePanelPresent(true); return; }
    const timer = window.setTimeout(() => setThemePanelPresent(false), 240);
    return () => window.clearTimeout(timer);
  }, [themeOpen]);
  const [aiWorkspaceBusy, setAIWorkspaceBusy] = useState(false);
  const [themeGalleryRequest, setThemeGalleryRequest] = useState(0);
  const [pageContextOpen, setPageContextOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const boardState = useBoardState(initialShortcutPages, brands);
  const { index: shortcutPage, setIndex: setShortcutPageIndex, pages: shortcutPages, setPages: setShortcutPages } = boardState;
  const [shortcutEditing, setShortcutEditing] = useState(false);
  const [boardEditing, setBoardEditing] = useState(false);
  const [pageActionsOpen, setPageActionsOpen] = useState(false);
  const [pageManagerOpen, setPageManagerOpen] = useState(false);
  const [submitted, setSubmitted] = useState({
    query: "",
    mode: "对话",
    model: "Auto",
    reference: "",
    attachments: [],
  });
  const composerRef = useRef(null);
  const aiComposerRef = useRef(null);
  const boardRef = useRef(null);
  const pageIndicatorRef = useRef(null);
  function setShortcutPage(update) {
    const next = typeof update === 'function' ? update(shortcutPage) : update;
    if (next !== shortcutPage) boardRef.current?.preparePageTransition(next > shortcutPage ? 1 : -1);
    setShortcutPageIndex(next);
  }
  const homeRef = useRef(null);
  // Wallpaper follows the whole new-tab shell, independent of the AI sidebar.
  useWindowWallpaperLayout(homeRef);
  const [themePortalHost, setThemePortalHost] = useState(null);
  useLayoutEffect(() => { setThemePortalHost(homeRef.current?.closest(".browser-content-row") || null); }, []);
  const oceanRef = useRef(null);
  const [oceanPhase, setOceanPhase] = useState('idle');
  const pageContextRef = useRef(null);
  const themeRef = useRef(null);
  const themeTriggerRef = useRef(null);
  const themeSelectionEpoch = useRef(0);
  const previousWidgetAIRef = useRef(widgetAI);
  const pageSwipeBlocked = !preferences.shortcuts || widgetAI || aiWorkspaceBusy || composerOpen || Boolean(dialog)
    || shortcutEditing || boardEditing || pageActionsOpen || pageManagerOpen || pageContextOpen;
  const pageSwipeAnnouncement = usePageSwipe(homeRef, {
    blocked: pageSwipeBlocked,
    pages: shortcutPages,
    index: shortcutPage,
    onSelect: setShortcutPage,
  });
  const illustratedTheme = getIllustratedTheme(preferences.theme);
  const oceanActive = isOceanTheme(preferences.theme);
  const darkAppearance = appearanceTheme === "dark";
  useEffect(() => {
    if (preferences.themeSource !== 'gallery' || (isWallpaperTheme(preferences.theme) && !selectedWallpaper)) return;
    const epoch = themeSelectionEpoch.current;
    let cancelled = false;
    getAutomaticThemeAppearance(preferences.theme, wallpaperLibrary.wallpapers).then(mode => {
      if (cancelled || themeSelectionEpoch.current !== epoch) return;
      setPreferences(current => current.appearance === mode ? current : { ...current, appearance:mode });
      if (spaceId !== null) localStorage.setItem(`tabbit-glass-theme-appearance:${spaceId}`, mode);
    });
    return () => { cancelled = true; };
  }, [preferences.theme, preferences.themeSource, selectedWallpaper?.url, wallpaperLibrary.wallpapers, spaceId]);


  useEffect(() => {
    if (previousWidgetAIRef.current === widgetAI) return;
    previousWidgetAIRef.current = widgetAI;
    setDialog(null);
    setPageManagerOpen(false);
    composerRef.current?.closeOverlays();
    aiComposerRef.current?.closeOverlays();
    boardRef.current?.dismissOverlays();
    setBoardEditing(false);
    if (!widgetAI) {
      const frame = requestAnimationFrame(() => themeTriggerRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [widgetAI]);

  function openWidgetAI(draft = null) {
    composerRef.current?.closeOverlays();
    setBoardEditing(false);
    const entryId = crypto.randomUUID();
    // A new handoff from home replaces the browser's previous forward branch.
    // Unmount its composer as well, releasing local attachment previews/files.
    setWidgetAIEntries([{ id: entryId, draft }]);
    setWidgetAIEntryId(entryId);
    setWidgetAIVisited(true);
    setWidgetAI(true);
  }

  function returnFromWidgetAI() {
    aiComposerRef.current?.closeOverlays();
    setWidgetAI(false);
  }

  function renameShortcutPage(id, name) {
    const nextName = name.trim().slice(0, 24);
    if (!nextName) return;
    setShortcutPages(pages => pages.map(page => page.id === id && page.name !== nextName ? { ...page, name: nextName } : page));
  }

  function openPageManager() {
    setDialog(null);
    composerRef.current?.closeOverlays();
    boardRef.current?.dismissOverlays();
    boardRef.current?.stopEditing();
    setBoardEditing(false);
    setPageManagerOpen(true);
  }

  function dismissPageOverlays() {
    setDialog(null);
    setPageManagerOpen(false);
    composerRef.current?.closeOverlays();
    boardRef.current?.dismissOverlays();
  }

  function openPageLibrary() {
    dismissPageOverlays();
    updatePreference('shortcuts', true);
    boardRef.current?.openLibrary();
  }

  function openAddShortcutPage() {
    dismissPageOverlays();
    boardRef.current?.stopEditing();
    setBoardEditing(false);
    updatePreference('shortcuts', true);
    pageIndicatorRef.current?.openAddPage();
  }

  function editCurrentPage() {
    dismissPageOverlays();
    updatePreference('shortcuts', true);
    boardRef.current?.startEditing();
  }

  function openThemeGallery() {
    dismissPageOverlays();
    setThemeGalleryRequest(value => value + 1);
    setThemeOpen(true);
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        themeRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    });
  }

  function addShortcutPage(name) {
    const nextName = name.trim().slice(0, 24);
    if (!nextName || shortcutPages.length >= 20) return false;
    setBoardEditing(false);
    setShortcutPages(pages => [...pages, { id: crypto.randomUUID(), name: nextName, items: [], layouts: {} }]);
    setShortcutPage(shortcutPages.length);
    updatePreference("shortcuts", true);
    return true;
  }

  function deleteShortcutPage(id) {
    const targetIndex = shortcutPages.findIndex(page => page.id === id);
    if (targetIndex < 0 || shortcutPages.length <= 1) return;
    const activeId = shortcutPages[shortcutPage].id;
    const nextPages = shortcutPages.filter(page => page.id !== id);
    const retainedIndex = nextPages.findIndex(page => page.id === activeId);
    if (id === activeId) setBoardEditing(false);
    setShortcutPages(nextPages);
    setShortcutPage(retainedIndex >= 0 ? retainedIndex : Math.min(targetIndex, nextPages.length - 1));
  }

  useLayoutEffect(() => {
    getHomeRoot().dataset.theme = surfaceAppearanceTheme;
    if (preferences.liquidGlass) {
      getHomeRoot().dataset.material = "liquid-glass";
    } else {
      delete getHomeRoot().dataset.material;
    }
    delete getHomeRoot().dataset.glassStyle;
    delete getHomeRoot().dataset.glassVariant;
    applyLiquidGlassOpacity(getHomeRoot(), preferences.liquidGlassOpacity);
  }, [surfaceAppearanceTheme, preferences.liquidGlass, preferences.liquidGlassOpacity]);

  useLayoutEffect(() => {
    const root = getHomeRoot();
    root.style.setProperty('--accent', controlAccent);
    root.style.setProperty('--checkbox-accent', checkboxAccent);
    if (composerFrameColor) root.style.setProperty('--composer-frame-fill', `color-mix(in srgb, ${composerFrameColor} 15%, transparent)`);
    else root.style.removeProperty('--composer-frame-fill');
  }, [controlAccent, checkboxAccent, composerFrameColor]);

  useLayoutEffect(() => {
    document.documentElement.dataset.largeTabRadius = String(preferences.largeTabRadius);
  }, [preferences.largeTabRadius]);
  useEffect(() => {
    // A direct art-review URL must not overwrite normal homepage preferences.
    if (new URLSearchParams(window.location.search).get('preview') === OCEAN_THEME_ID) return;
    try {
      localStorage.setItem(
        "personalized-home-2-0-preferences",
        JSON.stringify(preferences),
      );
    } catch {
      /* Keep session preferences when storage is unavailable. */
    }
  }, [preferences]);
  useEffect(() => {
    // Wait for IndexedDB before treating an uploaded theme as missing.
    if (!wallpaperLibrary.ready || !isWallpaperTheme(preferences.theme) || selectedWallpaper) return;
    const theme = darkAppearance ? 'dark' : 'light';
    themeSelectionEpoch.current += 1;
    setPreferences(current => current.theme === preferences.theme ? { ...current, theme, themeSource:'color' } : current);
    setWindowAppearance(localStorage.getItem(COLOR_WINDOW_APPEARANCE_KEY) || 'system');
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT, { detail:{ theme, themeSource:'color', ...baseGlassSettings, preset:true, reset:true } }));
  }, [wallpaperLibrary.ready, preferences.theme, selectedWallpaper, darkAppearance]);
  useEffect(() => {
    function onKey(event) {
      if (aiWorkspaceBusy) return;
      if (!getHomeRoot()?.contains(event.target)) return;
      if (widgetAI) {
        if (event.key === 'Escape' && !event.defaultPrevented && !dialog) aiComposerRef.current?.closeOverlays();
        if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !dialog && !composerOpen) {
          event.preventDefault(); aiComposerRef.current?.focus();
        }
        return;
      }
      if (event.key === "Escape" && !event.defaultPrevented && !dialog && !pageManagerOpen && !shortcutEditing) {
        if (composerOpen) composerRef.current?.closeOverlays();
        else if (themeOpen) closeThemePanel();
      }
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) &&
        !dialog && !pageManagerOpen && !shortcutEditing && !composerOpen
      ) {
        event.preventDefault();
        composerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [composerOpen, dialog, themeOpen, shortcutEditing, widgetAI, pageManagerOpen, aiWorkspaceBusy]);
  function closeThemePanel() {
    setThemeOpen(false);
    requestAnimationFrame(() => {
      themeTriggerRef.current?.focus({ preventScroll: true });
    });
  }
  function toggleThemePanel() {
    if (themeOpen) {
      closeThemePanel();
      return;
    }
    composerRef.current?.closeOverlays();
    setThemeGalleryRequest(0);
    setThemeOpen(true);
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        themeRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
  }
  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }
  function setModuleVisible(value) {
    if (!value) {
      boardRef.current?.dismissOverlays();
      setBoardEditing(false);
    }
    updatePreference("shortcuts", value);
  }
  function updatePageMenuPreference(key, value) {
    if (key === 'shortcuts') setModuleVisible(value);
    else updatePreference(key, value);
  }
  async function selectTheme(theme, wallpapers = wallpaperLibrary.wallpapers) {
    const epoch = ++themeSelectionEpoch.current;
    const appearance = await getAutomaticThemeAppearance(theme, wallpapers);
    if (themeSelectionEpoch.current !== epoch) return;
    setPreferences(current => ({ ...current, theme, themeSource:'gallery', appearance }));
    setSpaceColor(baseGlassSettings.color);
    setFrameTint(baseGlassSettings.tint);
    setFrameClear(false);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT, { detail:{ theme, themeSource:'gallery', appearance, ...baseGlassSettings, preset:true, reset:true } }));
  }
  function selectSpaceColor(color, preset) {
    themeSelectionEpoch.current += 1;
    const mode = localStorage.getItem(COLOR_WINDOW_APPEARANCE_KEY) || 'system';
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const theme = dark ? 'dark' : 'light';
    const swatch = spaceColors.find(item => item.tintColor.toLowerCase() === color.toLowerCase());
    setPreferences(current => ({ ...current, theme, themeSource:'color', appearance:mode }));
    setWindowAppearance(mode);
    setSpaceColor(color);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT, { detail:{ theme, themeSource:'color', color, ...preset, tint:swatch ? dark ? swatch.darkTint : swatch.tint : preset?.tint } }));
  }
  function updateFrameTint(tint, detail = {}) {
    if (preferences.themeSource === 'gallery') return;
    setFrameTint(tint);
    if (typeof detail.clear === 'boolean') setFrameClear(detail.clear);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT,{detail:{tint, ...detail}}));
  }
  function updateFrameClear(clear) {
    if (preferences.themeSource === 'gallery') return;
    setFrameClear(clear);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT,{detail:{clear}}));
  }

  async function uploadWallpaper(file) {
    const epoch = themeSelectionEpoch.current;
    const item = await wallpaperLibrary.upload(file);
    // A later explicit theme choice wins over an in-flight upload.
    if (item && themeSelectionEpoch.current === epoch) await selectTheme(item.id, [item, ...wallpaperLibrary.wallpapers]);
  }
  function usePrompt(text) {
    (widgetAI ? aiComposerRef : composerRef).current?.setPrompt(text);
  }
  function submit(payload) {
    setSubmitted(payload);
    (widgetAI ? aiComposerRef : composerRef).current?.closeOverlays();
    setDialog("result");
  }
  function promotionAction(item) {
    composerRef.current?.closeOverlays();
    setDialog(item.kind);
  }

  const promotionProps = {
    items: promotions,
    onAction: promotionAction,
    onClose: () => updatePreference('promotion', false),
    paused: Boolean(widgetAI || aiWorkspaceBusy || composerOpen || dialog || themeOpen || shortcutEditing || pageActionsOpen || pageManagerOpen || pageContextOpen),
  };

  const themeSidebar = (
      <aside
        ref={themeRef}
        className="theme-sidebar"
        aria-label="主题设置侧边栏"
        aria-hidden={!themeOpen}
        inert={!themeOpen}
      >
        <ThemeSidebarResizeHandle />
        <div className="theme-sidebar-content">
          {(themeOpen || themePanelPresent) && !widgetAI && (
          <ThemePanel
            openThemesRequest={themeGalleryRequest}
            theme={preferences.theme}
            themeSource={preferences.themeSource}
            onTheme={selectTheme}
            appearance={effectiveAppearance}
            resolvedAppearance={appearanceTheme}
            onAppearance={value => { if (preferences.themeSource === 'color') setWindowAppearance(value); }}
            spaceColor={spaceColor}
            onSpaceColor={selectSpaceColor}
            frameTint={frameTint}
            frameClear={frameClear}
            onFrameClear={updateFrameClear}
            onFrameTint={updateFrameTint}
            wallpaperLibrary={wallpaperLibrary}
            onUploadWallpaper={uploadWallpaper}
            largeTabRadius={preferences.largeTabRadius}
            onLargeTabRadius={(value) => updatePreference("largeTabRadius", value)}
            pageWidth={preferences.pageWidth}
            onPageWidth={value => updatePreference("pageWidth", value)}
            selectedAppIcon={selectedAppIcon}
            onAppIcon={setSelectedAppIcon}
            onDefaultBrowserUnlock={() => promotionAction(promotions.find(item => item.kind === 'default-browser'))}
            onClose={closeThemePanel}
            showShortcuts={preferences.shortcuts}
            onShortcuts={setModuleVisible}
            showPromotion={preferences.promotion}
            onPromotion={(value) => updatePreference("promotion", value)}
            pageManagement={{ pages: shortcutPages, onOpen: openPageManager }}
          />
          )}
        </div>
      </aside>
  );

  return (
    <ComposerWeatherContext.Provider value={selectedWallpaper?.weather || null}>
    <AIWorkspace wallpaper={selectedWallpaper} reflectionWallpaper={selectedWallpaper || { url:illustratedTheme?.scene ? `/personalized-home-2-0/asset/themes/previews/${illustratedTheme.scene.id}.webp` : undefined, color:getThemeBackground(preferences.theme, appearanceTheme), name:illustratedTheme?.name || '当前主题' }} wallpaperTransition={wallpaperTransition} wallpaperBlur={preferences.wallpaperBlur} disabled={widgetAI} onActivityChange={setAIWorkspaceBusy} onNavigatePage={() => setPageManagerOpen(false)} onNewChat={prompt => {
      setWidgetAI(false); aiComposerRef.current?.closeOverlays();
      setDialog(null); setThemeOpen(false); setPageManagerOpen(false); boardRef.current?.dismissOverlays(); setBoardEditing(false);
      composerRef.current?.startNew(prompt);
    }}>
    <div className={`home-layout ${themeOpen && !themePortalHost ? "is-theme-open" : ""}`} style={{ "--home-background": getThemeBackground(preferences.theme, appearanceTheme) }}>
    <main
      ref={homeRef}
      data-page-swipe-enabled={!pageSwipeBlocked && shortcutPages.length > 1 || undefined}
      className={`home${oceanActive ? " has-ocean-theme" : ""}`}
      aria-label="个性化首页 2.0"
      data-background-theme={preferences.theme}
      data-shortcuts-visible={preferences.shortcuts ? "true" : "false"}
      data-shortcut-shape={preferences.shortcutShape}
      data-artwork-background={Boolean(illustratedTheme || selectedWallpaper || oceanActive) || undefined}
      data-wallpaper-blur={preferences.wallpaperBlur || undefined}
    >
      <HomeBackground
        theme={preferences.theme}
        illustratedTheme={illustratedTheme}
        active={!widgetAI}
        paused={Boolean(widgetAI || composerOpen || dialog || shortcutEditing || boardEditing || pageActionsOpen || pageManagerOpen || pageContextOpen)}
        ocean={oceanActive ? {
          ref: oceanRef, homeRef, pageKey: shortcutPages[shortcutPage].id,
          onPhaseChange: setOceanPhase,
        } : null}
      />
      <div className="tb-composer-scroll-glass" aria-hidden="true"><span /></div>
      <HomeContent
        pageWidth={preferences.pageWidth}
        showShortcuts={preferences.shortcuts}
        onToggleShortcuts={() => setModuleVisible(!preferences.shortcuts)}
        appIconIndex={selectedAppIcon}
        spaceColor={spaceColor}
        wallpaper={selectedWallpaper}
        ocean={oceanActive ? {phase: oceanPhase, onCast: () => oceanRef.current?.cast()} : null}
        composerProps={{
          ref: composerRef, onSubmit: submit, onVoice: () => setDialog('voice'),
          externalOverlayOpen: !widgetAI && (dialog === 'voice' || dialog === 'result'),
          onOverlayChange: setComposerOpen,
        }}
        promotionProps={preferences.promotion && preferences.promotionStyle === 'inline' ? promotionProps : null}
        boardProps={{
          ref: boardRef, visible: preferences.shortcuts, active: hostActive && !widgetAI && !aiWorkspaceBusy,
          showEmptyHint: shortcutPage !== 2,
          editing: boardEditing, overlayBlocked: Boolean(aiWorkspaceBusy || composerOpen || dialog || pageActionsOpen || pageManagerOpen || pageContextOpen),
          onPageContextMenu: event => pageContextRef.current?.open(event),
          onAddPage: openAddShortcutPage,
          onEditModeChange: setBoardEditing,
          page: shortcutPages[shortcutPage], pages: shortcutPages,
          onPageChange: (update, pageId) => setShortcutPages(pages => applyBoardPageChange(pages, update, pageId)),
          onInitializeLayoutOrder: boardState.initializeLayoutOrder,
          onRenameGroup: name => renameShortcutPage(shortcutPages[shortcutPage].id, name),
          onDeleteGroup: () => deleteShortcutPage(shortcutPages[shortcutPage].id),
          onTransfer: (id, targetId, context) => {
            const result = transferBoardItem(shortcutPages, shortcutPages[shortcutPage].id, targetId, id, context);
            if (result.ok) setShortcutPages(result.pages);
            return {ok: result.ok, message: result.message};
          },
          showLabels: preferences.shortcutLabels, appearanceTheme:surfaceAppearanceTheme,
          shortcutSize: preferences.shortcutSize, shortcutShape: preferences.shortcutShape,
          onEditingChange: setShortcutEditing, onGenerateWidget: openWidgetAI,
          undo: boardState.undo, redo: boardState.redo,
          canUndo: boardState.canUndo, canRedo: boardState.canRedo,
        }}
      />
      <HomeControls
        promotionProps={preferences.promotion && preferences.promotionStyle === 'card' ? promotionProps : null}
        themeButtonProps={{ref: themeTriggerRef, expanded: themeOpen, onClick: toggleThemePanel}}
        pageProps={!widgetAI ? {
          ref: pageIndicatorRef,
          visible: preferences.shortcuts,
          pages: shortcutPages, selectedIndex: shortcutPage,
          onRename: renameShortcutPage, onDelete: deleteShortcutPage,
          onReorder: boardState.reorderPage, onBusyChange: setPageActionsOpen,
          onSelect: index => {
            setBoardEditing(false);
            setShortcutPage(index);
            updatePreference('shortcuts', true);
          },
          onManage: openPageManager, onAddPage: addShortcutPage, onAdd: () => boardRef.current?.openLibrary(),
        } : null}
        announcement={pageSwipeAnnouncement}
      />
      {pageManagerOpen && !widgetAI && <PageManagerDialog
        homeAnchorRef={homeRef}
        appearanceTheme={appearanceTheme}
        pages={shortcutPages}
        activePageId={shortcutPages[shortcutPage].id}
        onSelect={id => {
          const index = shortcutPages.findIndex(page => page.id === id);
          if (index < 0) return;
          setShortcutPage(index);
          setPageManagerOpen(false);
        }}
        onReorder={boardState.reorderPage}
        onRename={renameShortcutPage}
        onDelete={deleteShortcutPage}
        onAdd={addShortcutPage}
        onClose={() => setPageManagerOpen(false)}
      />}

    </main>
      {!themePortalHost && themeSidebar}
    </div>
    </AIWorkspace>
    {themePortalHost && !widgetAI && createPortal(
      <div className="personalized-home browser-theme-panel-host" data-theme={surfaceAppearanceTheme} data-open={themeOpen} aria-hidden={!themeOpen} inert={!themeOpen} style={{ '--accent': controlAccent }}>
        {themeSidebar}
      </div>, themePortalHost
    )}
    <PageContextMenu ref={pageContextRef} enabled={!widgetAI && !aiWorkspaceBusy && !pageManagerOpen} canEdit={shortcutPages[shortcutPage].items.length > 0} canAddPage={shortcutPages.length < 20}
      preferences={preferences} onPreferenceChange={updatePageMenuPreference}
      onAdd={openPageLibrary} onAddPage={openAddShortcutPage} onEdit={editCurrentPage} onPageSettings={openPageManager}
      onThemeSettings={openThemeGallery} onOpenChange={setPageContextOpen} />
    {widgetAIVisited && widgetAIEntries.map(entry => {
      const active = widgetAI && entry.id === widgetAIEntryId;
      return <div key={entry.id} hidden={!active} inert={!active}>
        <WidgetAIChat active={active} initialDraft={entry.draft} composerRef={active ? aiComposerRef : undefined} onBack={returnFromWidgetAI} onSubmit={submit} onVoice={() => setDialog('voice')} onOverlayChange={active ? setComposerOpen : undefined} />
      </div>;
    })}
      {dialog && (
        <DemoDialog
          kind={dialog}
          promotion={promotions.find((item) => item.kind === dialog)}
          query={submitted.query}
          mode={submitted.mode}
          model={submitted.model}
          reference={submitted.reference}
          attachments={submitted.attachments}
          taskContext={submitted.taskContext}
          skill={submitted.skill}
          returnLabel={widgetAI ? '返回对话' : '返回首页'}
          onClose={() => setDialog(null)}
          onUsePrompt={usePrompt}
        />
      )}
    </ComposerWeatherContext.Provider>
  );
}
