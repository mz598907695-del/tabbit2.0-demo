import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { pickSpaceIcon } from './spaceIcons';
import { beginBrowserLayoutChange } from './browserLayoutMotion';
import './styles/tokens.css';
import './styles/semantic.css';
import './iconfont.css';
import './App.css';
import PersonalizedHome from './personalized-home-2-0';
import GlassControls from './GlassControls';
import VerticalSidebarResizeHandle from './VerticalSidebarResizeHandle';
import VerticalSpaceSwipe from './VerticalSpaceSwipe';
import DeleteSpaceDialog from './DeleteSpaceDialog';
import EditSpaceDialog from './EditSpaceDialog';
import type { SpaceAppearance } from './SpaceIcon';
import CreateSpaceDialog from './CreateSpaceDialog';
import { spaceColors } from './spaceColors';
import WallpaperMedia from './personalized-home-2-0/themes/WallpaperMedia';
import { WINDOW_WALLPAPER_EVENT, getWallpaperLayers, type WindowWallpaperState } from './windowWallpaper';
import { SpaceContext, defaultSpaceAppearances } from './browser/SpaceContext';
import { OrganizeTabsMark, VerticalToggleIcon } from './browser/BrowserIcons';
import WindowToolbar, { BookmarksRow } from './browser/BrowserToolbar';
import SpaceMenu from './browser/SpaceMenu';
import HorizontalTabs from './browser/HorizontalTabs';
import { VerticalSidebar, VerticalTabPreview } from './browser/VerticalTabs';
import { BOOKMARKS_TAB_ID, SPACE_TABS, spaceTabLayouts, sampleSpace, initialSpaceTab, isTabGroup } from './browser/tabs-data';
import type { Mode } from './browser/types';
import WorkspaceBookmarksPage from './personalized-home-2-0/ai-workspace/bookmarks/WorkspaceBookmarksPage';

const NewTabPage = memo(function NewTabPage({ hostActive }: { hostActive:boolean }) {
  return <PersonalizedHome hostActive={hostActive}/>;
});

const InternalBookmarksPage = memo(function InternalBookmarksPage() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.mode || 'light');
  useLayoutEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.dataset.mode || 'light');
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes:true, attributeFilter:['data-mode'] });
    return () => observer.disconnect();
  }, []);
  return <section className="personalized-home bookmark-internal-page" data-theme={theme}><WorkspaceBookmarksPage embedded/></section>;
});

function BrowserContent({ children, isNewTab }: { children:React.ReactNode; isNewTab:boolean }) {
  return <div className={`browser-content-row${isNewTab ? ' is-new-tab' : ''}`}>
    <div className={`content-area ${isNewTab ? "is-new-tab" : ""}`}>
      <div className={`content-container ${isNewTab ? "is-new-tab" : ""}`}>
        <div className="content-viewport">
          <div className="persistent-new-tab" hidden={!isNewTab} inert={!isNewTab}><NewTabPage hostActive={isNewTab}/></div>
          <div className="persistent-browser-page" hidden={isNewTab} inert={isNewTab}>{children}</div>
        </div>
      </div>
    </div>
  </div>;
}

function App() {
  const [selectedSpace, selectSpace] = useState(0);
  const [windowWallpaper, setWindowWallpaper] = useState<WindowWallpaperState>({ wallpaper:null, transition:null });
  useLayoutEffect(() => {
    const syncWallpaper = (event: Event) => {
      const detail = (event as CustomEvent<WindowWallpaperState>).detail;
      if (detail) setWindowWallpaper(detail);
    };
    window.addEventListener(WINDOW_WALLPAPER_EVENT, syncWallpaper);
    return () => window.removeEventListener(WINDOW_WALLPAPER_EVENT, syncWallpaper);
  }, []);
  const [spaceAppearances, setSpaceAppearances] = useState<SpaceAppearance[]>(defaultSpaceAppearances);
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const cancelCreate = useCallback(() => setCreateSpaceOpen(false), []);
  const confirmCreate = (name: string, theme: string) => {
    const id = spaceAppearances.length;
    SPACE_TABS[id] = sampleSpace(id, [], []);
    spaceTabLayouts.delete(id);
    const preset = spaceColors.find(item => item.color === theme) ?? spaceColors[0];
    const presetTint = document.documentElement.dataset.mode === "dark" ? preset.darkTint : preset.tint;
    localStorage.setItem(`tabbit-glass-space:${id}`, JSON.stringify({ color:preset.tintColor, tint:presetTint, clear: false, veil: 0, highlight: 0, edge: 15 }));
    localStorage.setItem(`tabbit-glass-tint:${id}`, String(presetTint));
    setSpaceAppearances((current) => [...current, { name, icon: pickSpaceIcon(name) }]);
    selectSpace(id);
    setCreateSpaceOpen(false);
  };
  const [editSpaceId, setEditSpaceId] = useState<number | null>(null);
  const cancelEdit = useCallback(() => setEditSpaceId(null), []);
  const confirmEdit = (appearance: SpaceAppearance) => {
    setSpaceAppearances((current) => current.map((space, index) => index === editSpaceId ? appearance : space));
    setEditSpaceId(null);
  };
  const [deletedSpaces, setDeletedSpaces] = useState<Set<number>>(new Set());
  const visibleSpaceIds = useMemo(() => spaceAppearances.map((_, index) => index).filter((index) => !deletedSpaces.has(index)), [deletedSpaces, spaceAppearances]);
  const [deleteSpaceId, setDeleteSpaceId] = useState<number | null>(null);
  const cancelDelete = useCallback(() => setDeleteSpaceId(null), []);
  const confirmDelete = () => {
    if (deleteSpaceId === null) return;
    const position = visibleSpaceIds.indexOf(deleteSpaceId);
    const remaining = visibleSpaceIds.filter((id) => id !== deleteSpaceId);
    if (!remaining.length) return;
    setDeletedSpaces((current) => new Set(current).add(deleteSpaceId));
    selectSpace(remaining[Math.min(position, remaining.length - 1)]);
    setDeleteSpaceId(null);
  };
  const [mode, setMode] = useState<Mode>("vertical");
  const [verticalCollapsed, setVerticalCollapsed] = useState(false);
  const [activeTabs, setActiveTabs] = useState<Record<number, string>>({});
  const activeTab = activeTabs[selectedSpace] ?? initialSpaceTab(selectedSpace);
  const isNewTab = !activeTab || activeTab === "new" || activeTab.endsWith(":new") || /^[a-f0-9]{8}-/i.test(activeTab);
  const setActiveTab = (id: string) => setActiveTabs((current) => ({ ...current, [selectedSpace]: id }));
  const setVerticalActiveTab = useCallback((spaceId:number, id:string) => setActiveTabs((current) => ({ ...current, [spaceId]:id })), []);
  useEffect(() => {
    const openWorkspace = () => setActiveTabs(current => ({ ...current, [selectedSpace]:"new" }));
    window.addEventListener("tabbit-open-ai-workspace", openWorkspace);
    return () => window.removeEventListener("tabbit-open-ai-workspace", openWorkspace);
  }, [selectedSpace]);
  const [menuOpen, setMenuOpen] = useState(false);
  const showSpaceMenu = () => setMenuOpen((open) => !open);
  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener("tabbit-content-pointerdown", closeMenu);
    return () => window.removeEventListener("tabbit-content-pointerdown", closeMenu);
  }, []);
  useEffect(() => {
    const switchSpace = (event: KeyboardEvent) => {
      if (deleteSpaceId !== null || editSpaceId !== null || createSpaceOpen) return;
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || event.isComposing) return;
      const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (!match) return;
      event.preventDefault();
      if (event.repeat) return;
      const target = visibleSpaceIds[Number(match[1]) - 1];
      if (target === undefined) return;
      selectSpace(target);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", switchSpace, true);
    return () => window.removeEventListener("keydown", switchSpace, true);
  }, [deleteSpaceId, editSpaceId, createSpaceOpen, visibleSpaceIds]);
  const setAllGroups = (open:boolean) => {
    window.dispatchEvent(new CustomEvent("tabbit-set-all-groups", { detail:{ spaceId:selectedSpace, expanded:open } }));
    setMenuOpen(false);
  };
  const changeMode = (nextMode:Mode) => { setMode(nextMode); setMenuOpen(false); };

  const spaceContext = useMemo(() => ({ selectedSpace, selectSpace, visibleSpaceIds, spaces:spaceAppearances }), [selectedSpace, visibleSpaceIds, spaceAppearances]);

  // Both layouts keep the same persistent page hosts; only the browser chrome differs.
  const seedGroup = SPACE_TABS[selectedSpace].groups[activeTab];
  const savedGroup = mode === 'vertical' ? spaceTabLayouts.get(selectedSpace)?.groups[activeTab] : undefined;
  const content = <BrowserContent isNewTab={isNewTab}>
    {isTabGroup(activeTab) ? (
      <section className="group-page">
        <h1><span className="collapsed-group-dot" style={{ background:savedGroup?.color ?? seedGroup?.color }}/>{savedGroup?.label ?? seedGroup?.label}</h1>
      </section>
    ) : activeTab === BOOKMARKS_TAB_ID ? <InternalBookmarksPage/> : <section className="website-demo-page"/>}
  </BrowserContent>;

  const verticalControls = <div className="vertical-topbar-controls">
    <button className="vertical-mode-toggle" aria-label={verticalCollapsed ? '展开垂直标签栏' : '收起垂直标签栏'} aria-expanded={!verticalCollapsed} onClick={() => { beginBrowserLayoutChange(); setVerticalCollapsed(value => !value); }}>
      <VerticalToggleIcon/>
    </button>
    <button className="vertical-space-entry" aria-label="空间菜单" onClick={event => { event.stopPropagation(); showSpaceMenu(); }}>
      <OrganizeTabsMark/>
    </button>
  </div>;

  return (
    <SpaceContext.Provider value={spaceContext}>
      <main className={`glass-surface mode-${mode} ${isNewTab ? 'has-new-tab' : ''} ${verticalCollapsed ? 'vertical-collapsed' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className="container-fill" aria-hidden="true">
          {getWallpaperLayers(windowWallpaper.wallpaper, windowWallpaper.transition).filter(layer => layer.scene.url).map(({ scene, incoming, outgoing }) => (
            <div key={scene.id} className={`container-wallpaper-background${incoming ? ' is-incoming' : ''}${outgoing ? ' is-outgoing' : ''}`}>
              <div className="window-wallpaper-canvas">
                <WallpaperMedia src={scene.url} mimeType={scene.mimeType} posterUrl={scene.posterUrl} data-wallpaper-id={scene.id}/>
              </div>
            </div>
          ))}
        </div>
        <div className="browser-window">
          {mode === 'horizontal' ? (
            <>
              <HorizontalTabs spaceId={selectedSpace} onSpace={showSpaceMenu} selectedTab={activeTab} setSelectedTab={setActiveTab}/>
              <div className="horizontal-browser">
                <WindowToolbar isNewTab={isNewTab} tabId={activeTab}/>
                {content}
              </div>
            </>
          ) : (
            <>
              <div className="vertical-topbar" data-tauri-drag-region>
                <WindowToolbar isNewTab={isNewTab} tabId={activeTab} showBookmarks={false} leading={verticalControls}/>
              </div>
              <VerticalSpaceSwipe
                renderPreview={id => <VerticalTabPreview spaceId={id} activeTab={activeTabs[id] ?? initialSpaceTab(id)}/>}
                spaces={spaceAppearances} spaceId={selectedSpace} spaceIds={visibleSpaceIds} onSelect={selectSpace} collapsed={verticalCollapsed}
              >
                <div className="vertical-sidebar-stack">
                  {visibleSpaceIds.map(id => (
                    <div key={id} className="vertical-space-sidebar-layer" hidden={id !== selectedSpace} inert={id !== selectedSpace}>
                      <VerticalSidebar spaceId={id} activeTab={activeTabs[id] ?? initialSpaceTab(id)} onTab={setVerticalActiveTab} collapsed={id === selectedSpace && verticalCollapsed} active={id === selectedSpace}/>
                    </div>
                  ))}
                </div>
              </VerticalSpaceSwipe>
              <VerticalSidebarResizeHandle collapsed={verticalCollapsed}/>
              <div className="vertical-browser-container">
                <div className="vertical-browser">
                  <BookmarksRow/>
                  {content}
                </div>
              </div>
            </>
          )}
          {menuOpen && <SpaceMenu
            mode={mode} onMode={changeMode} onClose={() => setMenuOpen(false)} setAll={setAllGroups}
            onCreate={() => { setMenuOpen(false); setCreateSpaceOpen(true); }}
            onEdit={() => { setMenuOpen(false); setEditSpaceId(selectedSpace); }}
            onDelete={() => { setMenuOpen(false); setDeleteSpaceId(selectedSpace); }}
          />}
          <GlassControls key={selectedSpace} spaceId={String(selectedSpace)} spaceName={spaceAppearances[selectedSpace].name}/>
          {deleteSpaceId !== null && <DeleteSpaceDialog onCancel={cancelDelete} onConfirm={confirmDelete}/>}
          {editSpaceId !== null && <EditSpaceDialog key={editSpaceId} space={spaceAppearances[editSpaceId]} onCancel={cancelEdit} onConfirm={confirmEdit}/>}
          {createSpaceOpen && <CreateSpaceDialog onCancel={cancelCreate} onConfirm={confirmCreate}/>}
        </div>
      </main>
    </SpaceContext.Provider>
  );
}

export default App;
