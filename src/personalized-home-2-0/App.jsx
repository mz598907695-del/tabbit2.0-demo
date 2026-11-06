import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import AIWorkspace from './ai-workspace/AIWorkspace';
import { getHomeRoot } from "./home-host";
import HomeBackground from './HomeBackground';
import HomeContent from './HomeContent';
import HomeControls from './HomeControls';
import { brands, initialShortcutPages, promotions } from './home-data';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import WidgetAIChat from "./WidgetAIChat";
import { ThemePanel, DemoDialog } from "./Overlays";
import PageContextMenu from "./PageContextMenu";
import PageManagerDialog from "./board/PageManagerDialog";
import ThemeSidebarResizeHandle from './ThemeSidebarResizeHandle';
import { resolvePreferences } from "./preferences";
import { spaceColors } from "../spaceColors";
import { useBoardState, transferBoardItem } from "./board/state";
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
import { readWindowAppearance, watchExistingTokenMode, WINDOW_APPEARANCE_KEY } from '../windowAppearance';

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

export function App() {
  const [widgetAI, setWidgetAI] = useState(false);
  const [widgetAIVisited, setWidgetAIVisited] = useState(false);
  const [widgetAIEntryId, setWidgetAIEntryId] = useState('initial');
  const [widgetAIEntries, setWidgetAIEntries] = useState(() => [{ id: 'initial', draft: null }]);
  const [preferences, setPreferences] = useState(readPreferences);
  const [spaceColor, setSpaceColor] = useState(baseGlassSettings.color);
  const controlColorPreset = spaceColors.find((item, index) => index > 0 && item.tintColor.toLowerCase() === spaceColor.toLowerCase());
  const controlAccent = controlColorPreset?.color || 'var(--nine-color-action-primary)';
  const [frameTint,setFrameTint] = useState(50);
  const [frameClear,setFrameClear] = useState(false);
  const [selectedAppIcon, setSelectedAppIcon] = useState(() => {
    const saved = Number.parseInt(localStorage.getItem('tabbit-app-icon-v1') || '0', 10);
    return Number.isInteger(saved) && saved >= 0 && saved < 10 ? saved : 0;
  });
  const [windowAppearance, setWindowAppearance] = useState(() => {
    return readWindowAppearance();
  });
  useEffect(() => {
    localStorage.setItem(WINDOW_APPEARANCE_KEY, windowAppearance);
    return watchExistingTokenMode(windowAppearance, resolved => {
      void invoke('set_window_appearance', { appearance:windowAppearance, resolved }).catch(error => {
        console.warn('Native window appearance update unavailable:', error);
      });
    });
  }, [windowAppearance]);
  useEffect(() => {
    localStorage.setItem('tabbit-app-icon-v1', String(selectedAppIcon));
    void invoke('set_app_icon', { index:selectedAppIcon + 1 }).catch(error => {
      console.warn('App icon update unavailable:', error);
    });
  }, [selectedAppIcon]);
  useEffect(() => {
    const syncSpaceTheme = event => {
      const theme = event.detail?.theme;
      if (typeof theme === 'string') setPreferences(current => current.theme === theme ? current : ({ ...current, theme, appearance:getThemeSelectionAppearance(theme,current.appearance) }));
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
  const [appearanceTheme, setAppearanceTheme] = useState(() => document.documentElement.dataset.mode === "dark" ? "dark" : "light");
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
  function setShortcutPage(update) {
    const next = typeof update === 'function' ? update(shortcutPage) : update;
    if (next !== shortcutPage) boardRef.current?.preparePageTransition(next > shortcutPage ? 1 : -1);
    setShortcutPageIndex(next);
  }
  const homeRef = useRef(null);
  const [themePortalHost, setThemePortalHost] = useState(null);
  useLayoutEffect(() => { setThemePortalHost(homeRef.current?.closest(".browser-content-row") || null); }, []);
  const oceanRef = useRef(null);
  const [oceanPhase, setOceanPhase] = useState('idle');
  const pageContextRef = useRef(null);
  const themeRef = useRef(null);
  const themeTriggerRef = useRef(null);
  const paletteIconRef = useRef(null);
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
  const currentShortcuts = shortcutPages[shortcutPage].items.map((entry, index) => {
    if (!Array.isArray(entry)) return entry;
    const [key, label] = entry;
    return { ...brands[key], key, label, id: `${key}-${index}` };
  });

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

  useEffect(() => {
    const root = document.documentElement;
    const syncMode = () => setAppearanceTheme(root.dataset.mode === "dark" ? "dark" : "light");
    const observer = new MutationObserver(syncMode);
    observer.observe(root, {attributes: true, attributeFilter: ["data-mode"]});
    syncMode();
    return () => observer.disconnect();
  }, []);


  useLayoutEffect(() => {
    getHomeRoot().dataset.theme = appearanceTheme;
    if (preferences.liquidGlass) {
      getHomeRoot().dataset.material = "liquid-glass";
    } else {
      delete getHomeRoot().dataset.material;
    }
    delete getHomeRoot().dataset.glassStyle;
    delete getHomeRoot().dataset.glassVariant;
    applyLiquidGlassOpacity(getHomeRoot(), preferences.liquidGlassOpacity);
  }, [appearanceTheme, preferences.liquidGlass, preferences.liquidGlassOpacity]);

  useLayoutEffect(() => {
    getHomeRoot().style.setProperty('--accent', controlAccent);
  }, [controlAccent]);

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
    setPreferences((current) => current.theme === preferences.theme
      ? { ...current, theme: darkAppearance ? "dark" : "light" }
      : current);
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
  function selectTheme(theme) {
    themeSelectionEpoch.current += 1;
    setPreferences((current) => ({ ...current, theme, appearance: getThemeSelectionAppearance(theme, current.appearance) }));
    const color = theme === 'light' ? baseGlassSettings.color : getThemeBackground(theme, preferences.appearance);
    setSpaceColor(color);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT, { detail:{ theme, color } }));
  }
  function selectSpaceColor(color, preset) {
    setSpaceColor(color);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT, { detail:{ theme:preferences.theme, color, ...preset } }));
  }
  function updateFrameTint(tint, detail = {}) {
    setFrameTint(tint);
    if (typeof detail.clear === 'boolean') setFrameClear(detail.clear);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT,{detail:{tint, ...detail}}));
  }
  function updateFrameClear(clear) {
    setFrameClear(clear);
    window.dispatchEvent(new CustomEvent(GLASS_THEME_EVENT,{detail:{clear}}));
  }

  async function uploadWallpaper(file) {
    const epoch = themeSelectionEpoch.current;
    const item = await wallpaperLibrary.upload(file);
    // A later explicit theme choice wins over an in-flight upload.
    if (item && themeSelectionEpoch.current === epoch) selectTheme(item.id);
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
            onTheme={selectTheme}
            appearance={windowAppearance}
            resolvedAppearance={appearanceTheme}
            onAppearance={setWindowAppearance}
            spaceColor={spaceColor}
            onSpaceColor={selectSpaceColor}
            frameTint={frameTint}
            frameClear={frameClear}
            onFrameClear={updateFrameClear}
            onFrameTint={updateFrameTint}
            wallpaperLibrary={wallpaperLibrary}
            onUploadWallpaper={uploadWallpaper}
            liquidGlass={preferences.liquidGlass}
            onLiquidGlass={(value) => updatePreference("liquidGlass", value)}
            liquidGlassOpacity={preferences.liquidGlassOpacity}
            onLiquidGlassOpacity={(value) => updatePreference("liquidGlassOpacity", value)}
            wallpaperBlur={preferences.wallpaperBlur}
            onWallpaperBlur={(value) => updatePreference("wallpaperBlur", value)}
            shortcutShape={preferences.shortcutShape}
            onShortcutShape={(value) => updatePreference("shortcutShape", value)}
            shortcutSize={preferences.shortcutSize}
            onShortcutSize={(value) => updatePreference("shortcutSize", value)}
            pageWidth={preferences.pageWidth}
            onPageWidth={(value) => updatePreference("pageWidth", value)}
            largeTabRadius={preferences.largeTabRadius}
            onLargeTabRadius={(value) => updatePreference("largeTabRadius", value)}
            selectedAppIcon={selectedAppIcon}
            onAppIcon={setSelectedAppIcon}
            onClose={closeThemePanel}
            showShortcuts={preferences.shortcuts}
            onShortcuts={setModuleVisible}
            showShortcutLabels={preferences.shortcutLabels !== false}
            onShortcutLabels={(value) => updatePreference("shortcutLabels", value)}
            showPromotion={preferences.promotion}
            onPromotion={(value) => updatePreference("promotion", value)}
            promotionStyle={preferences.promotionStyle}
            onPromotionStyle={(value) => updatePreference("promotionStyle", value)}
            onAddContent={() => boardRef.current?.openLibrary()}
            pageManagement={{ pages: shortcutPages, onOpen: openPageManager }}
          />
          )}
        </div>
      </aside>
  );

  return (
    <>
    <AIWorkspace disabled={widgetAI} onActivityChange={setAIWorkspaceBusy} onNewChat={prompt => {
      setWidgetAI(false); aiComposerRef.current?.closeOverlays();
      setDialog(null); setThemeOpen(false); setPageManagerOpen(false); boardRef.current?.dismissOverlays(); setBoardEditing(false);
      composerRef.current?.startNew(prompt);
    }}>
    <div className={`home-layout ${themeOpen && !themePortalHost ? "is-theme-open" : ""}`} style={{ "--home-background": getThemeBackground(preferences.theme, appearanceTheme) }}>
    <main
      ref={homeRef}
      data-page-swipe-enabled={!pageSwipeBlocked && shortcutPages.length > 1 || undefined}
      className={`home ${oceanActive ? 'has-ocean-theme' : ''} ${illustratedTheme ? "has-illustrated-theme" : ""} ${preferences.shortcuts && currentShortcuts.length > 9 ? "has-multiple-shortcut-rows" : ""} ${preferences.promotion && preferences.promotionStyle === "inline" ? "has-inline-promotion" : ""} ${preferences.promotion && preferences.promotionStyle === "card" ? "has-corner-promotion" : ""}`}
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
        wallpaper={selectedWallpaper}
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
        ocean={oceanActive ? {phase: oceanPhase, onCast: () => oceanRef.current?.cast()} : null}
        composerProps={{
          ref: composerRef, onSubmit: submit, onVoice: () => setDialog('voice'),
          externalOverlayOpen: !widgetAI && (dialog === 'voice' || dialog === 'result'),
          onOverlayChange: setComposerOpen,
        }}
        promotionProps={preferences.promotion && preferences.promotionStyle === 'inline' ? promotionProps : null}
        boardProps={{
          ref: boardRef, visible: preferences.shortcuts, active: !widgetAI && !aiWorkspaceBusy,
          showEmptyHint: shortcutPage !== 2,
          editing: boardEditing, overlayBlocked: Boolean(aiWorkspaceBusy || composerOpen || dialog || pageActionsOpen || pageManagerOpen || pageContextOpen),
          onPageContextMenu: event => pageContextRef.current?.open(event),
          onEditModeChange: setBoardEditing,
          page: shortcutPages[shortcutPage], pages: shortcutPages,
          onPageChange: next => setShortcutPages(pages => pages.map(page => page.id === next.id ? next : page)),
          onInitializeLayoutOrder: boardState.initializeLayoutOrder,
          onRenameGroup: name => renameShortcutPage(shortcutPages[shortcutPage].id, name),
          onDeleteGroup: () => deleteShortcutPage(shortcutPages[shortcutPage].id),
          onTransfer: (id, targetId, context) => {
            const result = transferBoardItem(shortcutPages, shortcutPages[shortcutPage].id, targetId, id, context);
            if (result.ok) setShortcutPages(result.pages);
            return {ok: result.ok, message: result.message};
          },
          showLabels: preferences.shortcutLabels, appearanceTheme,
          shortcutSize: preferences.shortcutSize, shortcutShape: preferences.shortcutShape,
          onEditingChange: setShortcutEditing, onGenerateWidget: openWidgetAI,
          undo: boardState.undo, redo: boardState.redo,
          canUndo: boardState.canUndo, canRedo: boardState.canRedo,
        }}
      />
      <HomeControls
        promotionProps={preferences.promotion && preferences.promotionStyle === 'card' ? promotionProps : null}
        themeButtonProps={{ref: themeTriggerRef, paletteIconRef, expanded: themeOpen, onClick: toggleThemePanel}}
        pageProps={!widgetAI ? {
          visible: preferences.shortcuts,
          pages: shortcutPages, selectedIndex: shortcutPage,
          onRename: renameShortcutPage, onDelete: deleteShortcutPage,
          onReorder: boardState.reorderPage, onBusyChange: setPageActionsOpen,
          onSelect: index => {
            setBoardEditing(false);
            setShortcutPage(index);
            updatePreference('shortcuts', true);
          },
          onManage: openPageManager, onAdd: () => boardRef.current?.openLibrary(),
        } : null}
        announcement={pageSwipeAnnouncement}
      />
      {pageManagerOpen && !widgetAI && <PageManagerDialog
        pages={shortcutPages}
        activePageId={shortcutPages[shortcutPage].id}
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
      <div className="personalized-home browser-theme-panel-host" data-theme={appearanceTheme} data-open={themeOpen} aria-hidden={!themeOpen} inert={!themeOpen} style={{ '--accent': controlAccent }}>
        {themeSidebar}
      </div>, themePortalHost
    )}
    <PageContextMenu ref={pageContextRef} enabled={!widgetAI && !aiWorkspaceBusy} canEdit={currentShortcuts.length > 0}
      preferences={preferences} onPreferenceChange={updatePageMenuPreference}
      onAdd={openPageLibrary} onEdit={editCurrentPage} onPageSettings={openPageManager}
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
    </>
  );
}
