import { getCurrentWindow } from "@tauri-apps/api/window";
import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pickSpaceIcon, spaceIconByName } from "./spaceIcons";
import { siteIconFor, tabIconFor, tabSites } from "./favicons";
import { tabAddressFor } from "./tabAddresses";
import newTabIcon from "./assets/new-tab.svg";
import profileAvatar from "./assets/profile-avatar.png";
import organizeTabsIcon from "./assets/organize-tabs.svg";
import verticalTabsIcon from "./assets/vertical-tabs.svg";
import collapseTabsIcon from "./assets/collapse-tabs.svg";
import expandTabsIcon from "./assets/expand-tabs.svg";
import "./styles/tokens.css";
import "./styles/semantic.css";
import "./iconfont.css";
import "./App.css";
import PersonalizedHome from "./personalized-home-2-0";
import GlassControls from "./GlassControls";
import DropdownPanel from "./DropdownPanel";
import VerticalSidebarResizeHandle from "./VerticalSidebarResizeHandle";
import VerticalSpaceSwipe from "./VerticalSpaceSwipe";
import DeleteSpaceDialog from "./DeleteSpaceDialog";
import EditSpaceDialog from "./EditSpaceDialog";
import SpaceIcon, { type SpaceAppearance } from "./SpaceIcon";
import CreateSpaceDialog from "./CreateSpaceDialog";
import { spaceColors } from "./spaceColors";

const spaceIcons = ["汉堡", "游戏手柄", "18 禁", "树", "脑子", "蘑菇", "薯条", "酷", "车"].map((name) => spaceIconByName[name]);
const spaceNames = ["美团", "游戏", "娱乐", "生活", "思考", "灵感", "休闲", "个人", "汽车"];
const defaultSpaceAppearances = spaceNames.slice(0, 5).map((name, index) => ({ name, icon: spaceIcons[index] }));
const SpaceContext = createContext<{ selectedSpace: number; selectSpace: (index: number) => void; visibleSpaceIds: number[]; spaces: SpaceAppearance[] }>({ selectedSpace: 0, selectSpace: () => {}, visibleSpaceIds: defaultSpaceAppearances.map((_, index) => index), spaces: defaultSpaceAppearances });

type Mode = "horizontal" | "vertical";
const bookmarks: { label: string; folder?: boolean; site?: string }[] = [
  { label: "美团", folder: true }, { label: "个人收藏", folder: true },
  { label: "Notion", site: "notion" }, { label: "yang", site: "yang" },
  { label: "purposetalent", site: "purposetalent" }, { label: "trickle", site: "trickle" },
  { label: "Grok", site: "grok" }, { label: "Claude", site: "claude" },
];
function IconFont({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`iconfont icon-${name} ${className}`} aria-hidden="true" />;
}

function OrganizeTabsMark({ className = "" }: { className?: string }) {
  return <span className={`organize-tabs-mark ${className}`} aria-hidden="true"><img src={organizeTabsIcon} alt=""/><span className="organize-tabs-center"/></span>;
}

function TokenIcon({ src, className = "" }: { src: string; className?: string }) {
  const mask = `url("${src}")`;
  return <span className={`token-icon ${className}`} style={{ WebkitMaskImage: mask, maskImage: mask }} aria-hidden="true"/>;
}

function TabFavicon({ id, className = "tab-icon" }: { id: string; className?: string }) {
  const src = tabIconFor(id);
  const site = tabSites[id];
  return src === newTabIcon
    ? <span className={`${className} new-tab-page-icon`} aria-hidden="true" />
    : <img className={className} data-site={site} src={src} alt="" draggable={false} />;
}

function SiteFavicon({ site }: { site: string }) {
  const src = siteIconFor(site);
  if (!src) return <IconFont name="diqiu"/>;
  return <img data-site={site} src={src} alt="" draggable={false}/>;
}

function SpaceContainer({ onClick }: { onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { selectedSpace, spaces, visibleSpaceIds } = useContext(SpaceContext);
  const singleSpace = visibleSpaceIds.length === 1;
  const previousSpace = useRef(selectedSpace);
  const contentRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const previous = previousSpace.current;
    previousSpace.current = selectedSpace;
    const content = contentRef.current;
    if (!content || previous === selectedSpace || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const direction = selectedSpace > previous ? 1 : -1;
    const styles = getComputedStyle(content);
    const animation = content.animate([
      { transform: `translateX(${direction * 12}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 }
    ], { duration: parseFloat(styles.getPropertyValue("--space-switch-duration")) || 400, easing: styles.getPropertyValue("--motion-easing-standard").trim() || "ease-out" });
    return () => animation.cancel();
  }, [selectedSpace, singleSpace]);
  return <button className={`space-container ${singleSpace ? "single-space" : ""}`} aria-label={singleSpace ? "空间菜单" : undefined} onClick={onClick}>
    {singleSpace ? <OrganizeTabsMark className="space-icon"/> : <span className="space-content-clip"><span className="space-content" ref={contentRef}>
      <SpaceIcon className="space-icon" space={spaces[selectedSpace]}/>
      <span>{spaces[selectedSpace].name}</span>
    </span></span>}
  </button>;
}

function WindowToolbar({ isNewTab, tabId, leading, showBookmarks = true }: { isNewTab: boolean; tabId: string; leading?:React.ReactNode; showBookmarks?:boolean }) {
  const { selectedSpace } = useContext(SpaceContext);
  const addressKey = `${selectedSpace}:${tabId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const addressDrag = useRef<{x:number; y:number} | null>(null);
  const addressWasDragged = useRef(false);
  useEffect(() => {
    const move = (event:PointerEvent) => {
      const start = addressDrag.current;
      if (!start || !(event.buttons & 1)) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) return;
      addressDrag.current = null;
      addressWasDragged.current = true;
      getCurrentWindow().startDragging().catch(error => console.warn("Address bar window drag failed", error));
    };
    const end = () => { addressDrag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); window.removeEventListener("blur", end); };
  }, []);

  const [addresses, setAddresses] = useState<Record<string, string>>({});
  return <>
    <div className="address-row" data-tauri-drag-region>
      {leading}
      <div className="nav-actions address-actions-left" data-tauri-drag-region>
        <button aria-label="后退" disabled><IconFont name="nav-back"/></button><button aria-label="前进" disabled><IconFont name="nav-forward"/></button><button aria-label="刷新" disabled={isNewTab}><IconFont name="nav-refresh"/></button>
      </div>
      <div className="address-field" onPointerDown={event => {
        addressWasDragged.current = false;
        if (event.button !== 0 || !("__TAURI_INTERNALS__" in window) || (event.target as HTMLElement).closest("button") || document.activeElement === inputRef.current) return;
        event.preventDefault();
        addressDrag.current = {x:event.clientX, y:event.clientY};
      }} onClick={event => {
        if (addressWasDragged.current) { addressWasDragged.current = false; return; }
        if (!(event.target as HTMLElement).closest("button")) inputRef.current?.focus();
      }}>
        <input ref={inputRef} className="address-input" aria-label="地址栏" placeholder="搜索或输入网址" value={addresses[addressKey] ?? tabAddressFor(tabId)} onChange={(event) => setAddresses((current) => ({ ...current, [addressKey]: event.target.value }))} spellCheck={false} autoComplete="off"/>
        <div className="address-field-actions">
          <button type="button" aria-label="收藏当前页面"><IconFont name="xingxing"/></button>
          <button type="button" aria-label="语言"><IconFont name="yuyan_zhongwen_yingwen"/></button>
        </div>
      </div>
      <div className="toolbar-actions address-actions-right" data-tauri-drag-region>
        <div className="toolbar-primary" data-tauri-drag-region>
          <button className="toolbar-icon-button" aria-label="应用"><IconFont name="xingzhuang_zhengfangxing_sanjiaoxing_yua"/></button>
          <button className="toolbar-icon-button" aria-label="个人资料"><img className="toolbar-avatar" src={profileAvatar} alt="" draggable={false}/></button>
          <button className="toolbar-icon-button" aria-label="更多"><IconFont name="dian_shenglvehao"/></button>
        </div>
        <button className="toolbar-icon-button" aria-label="灵感"><IconFont name="dengpao_xiangfa"/></button>
        <button className="chat-button"><span className="chat-button-icon" aria-hidden="true"/><span>Chat</span></button>
      </div>
    </div>
    {showBookmarks && <BookmarksRow/>}
  </>;
}

function BookmarksRow() { return (
    <div className="bookmarks-row" data-tauri-drag-region>
      {bookmarks.map((bookmark) => <button type="button" className="bookmark" key={bookmark.label}>
        {bookmark.folder ? <IconFont name="wenjianjia_3"/> : <SiteFavicon site={bookmark.site ?? ""}/>}<span>{bookmark.label}</span>
      </button>)}
    </div>
); }

function VerticalToggleIcon() {
  return <svg className="vertical-toggle-icon" width="16" height="16" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M2,35.5L2,12.5C2,8.9101489,4.910148899999999,6,8.5,6L39.5,6C43.089851,6,46,8.9101489,46,12.5L46,35.5C46,39.089851,43.089851,42,39.5,42L8.5,42C4.910148899999999,42,2,39.089851,2,35.5ZM6,35.5Q6,38,8.5,38L39.5,38Q42,38,42,35.5L42,12.5Q42,10,39.5,10L8.5,10Q6,10,6,12.5L6,35.5Z" fillRule="evenodd" fill="currentColor"/>
    <rect className="vertical-toggle-bar" x="9" y="13" width="8" height="22" rx="2" fill="currentColor"/>
  </svg>;
}

const NewTabPage = memo(function NewTabPage() {
  return <PersonalizedHome/>;
});

function BrowserContent({ children, isNewTab }: { children:React.ReactNode; isNewTab:boolean }) {
  return <div className={`browser-content-row${isNewTab ? ' is-new-tab' : ''}`}>
    <div className={`content-area ${isNewTab ? "is-new-tab" : ""}`}>
      <div className={`content-container ${isNewTab ? "is-new-tab" : ""}`}>
        <div className="persistent-new-tab" hidden={!isNewTab} inert={!isNewTab}><NewTabPage/></div>
        <div className="persistent-browser-page" hidden={isNewTab} inert={isNewTab}>{children}</div>
      </div>
    </div>
  </div>;
}

function SpaceMenu({ mode, onMode, onClose, setAll, onDelete, onEdit, onCreate }: { mode: Mode; onMode: (mode: Mode) => void; onClose: () => void; setAll: (open: boolean) => void; onDelete: () => void; onEdit: () => void; onCreate: () => void }) {
  const { selectedSpace, selectSpace, visibleSpaceIds, spaces } = useContext(SpaceContext);
  const [tip, setTip] = useState<{ index: number; left: number; top: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTip = () => {
    if (tipTimer.current !== null) clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTip(null);
  };
  useEffect(() => () => { if (tipTimer.current !== null) clearTimeout(tipTimer.current); }, []);
  const showTip = (element: HTMLButtonElement, index: number) => {
    hideTip();
    const rect = element.getBoundingClientRect();
    tipTimer.current = setTimeout(() => {
      tipTimer.current = null;
      setTip({ index, left: Math.max(85, Math.min(window.innerWidth - 85, rect.left + rect.width / 2)), top: rect.top >= 38 ? rect.top - 8 : rect.bottom + 34 });
    }, 400);
  };
  return <DropdownPanel className="space-menu" label="空间菜单" onClose={onClose}>
    <div className="space-icon-grid">{visibleSpaceIds.map((index) => <button className={index === selectedSpace ? "selected" : ""} key={index} aria-label={spaces[index].name} aria-pressed={index === selectedSpace} onClick={() => { selectSpace(index); hideTip(); onClose(); }} aria-describedby={tip?.index === index ? "space-tooltip" : undefined} onMouseEnter={(event) => showTip(event.currentTarget, index)} onMouseLeave={hideTip} onFocus={(event) => showTip(event.currentTarget, index)} onBlur={hideTip}><SpaceIcon space={spaces[index]}/></button>)}<button className="space-add" aria-label="添加空间" onClick={onCreate}><IconFont name="jiahao"/></button></div>
    {tip && createPortal(<div id="space-tooltip" role="tooltip" className="space-tooltip" style={{ left: tip.left, top: tip.top }}><span>{spaces[tip.index].name}</span>{visibleSpaceIds.indexOf(tip.index) < 9 && <span className="space-tooltip-keys"><kbd>⌥</kbd><kbd>{visibleSpaceIds.indexOf(tip.index) + 1}</kbd></span>}</div>, document.body)}
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <button><span className="dropdown-item-content"><OrganizeTabsMark/><span>智能标签整理</span></span></button>
    <button onClick={() => { onMode(mode === "horizontal" ? "vertical" : "horizontal"); onClose(); }}><span className="dropdown-item-content"><TokenIcon src={verticalTabsIcon}/><span>切换为{mode === "horizontal" ? "垂直" : "水平"}标签栏</span></span></button>
    <button><span className="dropdown-item-content"><IconFont name="sort"/><span>标签页排序</span></span><span className="dropdown-item-trailing"><IconFont name="jiantou-v-xiangyou" className="menu-end"/></span></button>
    <button onClick={() => setAll(false)}><span className="dropdown-item-content"><TokenIcon src={collapseTabsIcon}/><span>收起所有标签组</span></span></button>
    <button onClick={() => setAll(true)}><span className="dropdown-item-content"><TokenIcon src={expandTabsIcon}/><span>展开所有标签组</span></span></button>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <button><span className="dropdown-item-content"><IconFont name="new-window"/><span>新建独立窗口</span></span><span className="dropdown-shortcut"><kbd>⌘</kbd><kbd>N</kbd></span></button>
    <button><span className="dropdown-item-content"><IconFont name="incognito"/><span>新建无痕窗口</span></span><span className="dropdown-shortcut"><kbd>⇧</kbd><kbd>⌘</kbd><kbd>N</kbd></span></button>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <button onClick={onEdit}><span className="dropdown-item-content"><IconFont name="edit"/><span>编辑空间</span></span></button>
    <button><span className="dropdown-item-content"><IconFont name="shezhi_chilun"/><span>空间管理</span></span></button>
    {visibleSpaceIds.length > 1 && <button className="danger" onClick={onDelete}><span className="dropdown-item-content"><IconFont name="trash"/><span>删除当前空间</span></span></button>}
  </DropdownPanel>;
}



const BRAND_GROUP_ID = "group:brand";
const GROUP_DIVIDER_SPACE = 10.5;
type DemoGroup = { label: string; color: string; expanded: boolean; tabs: { id: string; title: string }[] };
const DEMO_GROUPS: Record<string, DemoGroup> = {
  [BRAND_GROUP_ID]: { label: "重要工具！", color: "var(--color-orange-4)", expanded: false, tabs: [
    { id: "brand:trickle", title: "trickle" }, { id: "brand:claude", title: "Claude" },
  ] },
  "group:tools": { label: "社交媒体", color: "#00bfc9", expanded: false, tabs: [
    { id: "social:purposetalent", title: "purposetalent" }, { id: "social:x", title: "X.com" },
  ] },
  "group:learning": { label: "汽车", color: "#63be3c", expanded: false, tabs: [
    { id: "cars:nio", title: "蔚来 NIO" }, { id: "cars:onvo", title: "乐道汽车官方网站" },
  ] },
};
const isTabGroup = (id: string) => id.startsWith("group:");
type SpaceTabs = { groups: Record<string, DemoGroup>; loose: { id: string; title: string }[] };
const sampleSpace = (space: number, groups: { label: string; color: string; tabs: DemoGroup["tabs"] }[], loose: DemoGroup["tabs"] = []): SpaceTabs => ({
  groups: Object.fromEntries(groups.map((group, index) => [`group:space${space}:${index}`, { ...group, expanded: false }])), loose,
});
const SPACE_TABS: SpaceTabs[] = [
  { groups: DEMO_GROUPS, loose: [{ id: "notion-loose", title: "Notion" }, { id: "new", title: "New Tab" }] },
  sampleSpace(1, [], [
    {id:"games:steam",title:"Steam 游戏库"},
    {id:"games:indie",title:"独立游戏精选"},
    {id:"games:epic",title:"Epic Games"},
    {id:"games:community",title:"影之刃零"},
    {id:"games:reviews",title:"燕云十六声"},
    {id:"games:wishlist",title:"愿望清单"},
    {id:"home:notion",title:"Notion"},
    {id:"home:youtube",title:"YouTube"},
    {id:"home:deepl",title:"DeepL"},
    {id:"home:perplexity",title:"Perplexity"},
    {id:"home:netflix",title:"Netflix"},
    {id:"home:spotify",title:"Spotify"},
    {id:"home:google",title:"Google"},
    {id:"home:openai",title:"ChatGPT"},
    {id:"home:claude",title:"Claude"},
    {id:"home:dribbble",title:"Dribbble"},
    {id:"home:purposetalent",title:"purposetalent"},
    {id:"home:trickle",title:"trickle"},
    {id:"home:zoom",title:"Zoom"},
    {id:"home:canva",title:"Canva"},
    {id:"home:figma",title:"Figma"},
    {id:"home:nio",title:"蔚来 NIO"},
    {id:"home:qq-music",title:"QQ 音乐"},
    {id:"home:drive",title:"Google Drive"},
    {id:"home:x",title:"X.com"},
    {id:"home:threads",title:"Threads"},
    {id:"home:dji",title:"大疆 DJI"},
    {id:"home:douyin",title:"抖音"},
    {id:"home:messenger",title:"Messenger"},
    {id:"home:facebook",title:"Facebook"},
    {id:"home:pinterest",title:"Pinterest"},
    {id:"home:slack",title:"Slack"},
    {id:"home:github",title:"GitHub"},
    {id:"home:yang",title:"yang"},
    {id:"home:grok",title:"Grok"},
  ]),
  sampleSpace(2, [], [
    { id: "fun:qq-music", title: "QQ 音乐" },
    { id: "fun:bilibili", title: "哔哩哔哩" },
    { id: "fun:youtube", title: "YouTube" },
    { id: "fun:music", title: "网易云音乐" },
    { id: "fun:podcast", title: "小宇宙播客" },
    { id: "social:purposetalent", title: "purposetalent" },
    { id: "brand:trickle", title: "trickle" },
    { id: "notion-loose", title: "Notion" },
  ]),
  sampleSpace(3, [{ label: "生活清单", color: "#65b848", tabs: [{ id: "life:weekend", title: "周末去哪里" }, { id: "life:home", title: "居家灵感" }] }], [{ id: "notion-loose", title: "Notion" }]),
  sampleSpace(4, [], [{ id: "brand:claude", title: "Claude" }, { id: "notion-loose", title: "Notion" }]),
  sampleSpace(5, [
    { label: "设计收藏", color: "#f39833", tabs: [{ id: "brand:trickle", title: "trickle" }, { id: "social:purposetalent", title: "purposetalent" }] },
    { label: "随手记", color: "#00bfc9", tabs: [{ id: "notion-loose", title: "Notion" }] },
  ]),
  sampleSpace(6, [{ label: "放松一下", color: "#e6a326", tabs: [{ id: "rest:music", title: "网易云音乐" }, { id: "rest:podcast", title: "播客时光" }] }]),
  sampleSpace(7, [], [{ id: "notion-loose", title: "Notion" }, { id: "social:x", title: "X.com" }]),
  sampleSpace(8, [{ label: "看车计划", color: "#4b8ff7", tabs: [{ id: "cars:nio", title: "蔚来 NIO" }, { id: "cars:onvo", title: "乐道汽车官方网站" }] }], [{ id: "brand:claude", title: "Claude" }]),
];
const spaceTabLayouts = new Map<number, { tabs: string[]; groups: Record<string, DemoGroup> }>();
const initialSpaceTab = (_space: number) => "new";
const initialSpaceTabs = (space: number) => {
  const seed = SPACE_TABS[space];
  return ["new", ...Object.keys(seed.groups), ...seed.loose.filter((tab) => tab.id !== "new").map((tab) => tab.id)];
};

function CollapsedBrandContent({ expanded = false, onToggle, label = "品牌资源", color = "var(--color-orange-4)" }: { expanded?: boolean; onToggle?: () => void; label?: string; color?: string }) {
  const arrow = <IconFont name="jiantou-v-xiangyou"/>;
  return <><span className="collapsed-group-content"><span className="collapsed-group-marker"><span className="collapsed-group-dot" style={{ background: color }}/></span><span className="tab-title">{label}</span></span>{onToggle ? <button className={`collapsed-group-arrow ${expanded ? "expanded" : ""}`} aria-label={`${expanded ? "收起" : "展开"}${label}`} aria-expanded={expanded} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggle(); }}>{arrow}</button> : <span className="collapsed-group-arrow">{arrow}</span>}</>;
}

type HorizontalTabsProps = { onSpace: () => void; selectedTab: string; setSelectedTab: (id: string) => void; spaceId: number };
function HorizontalTabs({ onSpace, ...props }: HorizontalTabsProps) {
  const lastProps = useRef(props);
  const [transition, setTransition] = useState<{ spaceId: number; previous: typeof props | null; direction: number; animate: boolean }>({ spaceId: props.spaceId, previous: null, direction: 1, animate: false });
  if (transition.spaceId !== props.spaceId) {
    setTransition({ spaceId: props.spaceId, previous: lastProps.current, direction: props.spaceId > transition.spaceId ? 1 : -1, animate: true });
  }
  useLayoutEffect(() => { lastProps.current = props; });
  useEffect(() => {
    if (!transition.previous) return;
    const timer = window.setTimeout(() => setTransition((current) => current.spaceId === transition.spaceId ? { ...current, previous: null } : current), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [transition.spaceId, transition.previous]);
  return <div className="horizontal-tabs" data-tauri-drag-region>
    <SpaceContainer onClick={(event) => { event.stopPropagation(); onSpace(); }}/>
    <div className={`space-tab-stage ${transition.previous ? "is-switching" : ""}`} data-tauri-drag-region style={{ "--space-direction": transition.direction } as React.CSSProperties}>
      {transition.previous && <div key={transition.previous.spaceId} className="space-tab-layer is-exiting" aria-hidden="true" inert onAnimationEnd={(event) => { if (event.target === event.currentTarget) setTransition((current) => ({ ...current, previous: null })); }}>
        <HorizontalTabContents {...transition.previous} active={false}/>
      </div>}
      <div key={props.spaceId} className={`space-tab-layer ${transition.animate ? "is-entering" : ""}`} data-tauri-drag-region>
        <HorizontalTabContents {...props} active/>
      </div>
    </div>
  </div>;
}

function HorizontalTabContents({ selectedTab, setSelectedTab, spaceId, active }: Omit<HorizontalTabsProps, "onSpace"> & { active: boolean }) {
  const seed = SPACE_TABS[spaceId];
  const [tabs, setTabs] = useState(() => spaceTabLayouts.get(spaceId)?.tabs ?? initialSpaceTabs(spaceId));
  const [tabGroups, setTabGroups] = useState(() => spaceTabLayouts.get(spaceId)?.groups ?? seed.groups);
  useEffect(() => { spaceTabLayouts.set(spaceId, { tabs, groups: tabGroups }); }, [spaceId, tabs, tabGroups]);
  useEffect(() => {
    if (!active) return;
    const setAll = (event: Event) => {
      const { spaceId: target, expanded } = (event as CustomEvent<{ spaceId: number; expanded: boolean }>).detail;
      if (target !== spaceId) return;
      setTabGroups((current) => Object.fromEntries(Object.entries(current).map(([id, group]) => [id, { ...group, expanded: expanded && group.tabs.length > 0 }])));
    };
    window.addEventListener("tabbit-set-all-groups", setAll);
    return () => window.removeEventListener("tabbit-set-all-groups", setAll);
  }, [active, spaceId]);
  const normalTabs = tabs.filter((id) => !isTabGroup(id));
  const tabCount = normalTabs.length;
  const groupIds = tabs.filter(isTabGroup);
  const [groupWidth, setGroupWidth] = useState(306);
  const [groupHeadingWidth, setGroupHeadingWidth] = useState(306);
  const brandTabs = useMemo(() => Object.values(tabGroups).flatMap((group) => group.tabs), [tabGroups]);
  const updateGroup = (id: string, update: (group: DemoGroup) => DemoGroup) => setTabGroups((current) => ({ ...current, [id]: update(current[id]) }));
  const tabTitles = useRef<Record<string, string>>(Object.fromEntries([...Object.values(seed.groups).flatMap((group) => group.tabs), ...seed.loose].map((tab) => [tab.id, tab.title])));
  const titleFor = (id: string) => tabTitles.current[id] ?? "New Tab";
  const [groupDropTarget, setGroupDropTarget] = useState(false);
  const [attachmentGroup, setAttachmentGroup] = useState<string | null>(null);
  const [groupAttachment, setGroupAttachment] = useState({ left: 0, right: 0 });
  const [enteringTabs, setEnteringTabs] = useState<Set<string>>(new Set());
  const [closingTab, setClosingTab] = useState<string | null>(null);
  const [closingLayout, setClosingLayout] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [trackCapacity, setTrackCapacity] = useState(1000);
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; lastX: number; moved: boolean; offsetX: number; top: number; width: number; height: number; membershipChangedAt?: number } | null>(null);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ left: number; top: number; width: number; height: number; borderRadius: number } | null>(null);
  const suppressClick = useRef(false);
  const restoreExpandedAfterDrag = useRef<string | null>(null);
  const previousTabPositions = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const previous = previousTabPositions.current;
    previousTabPositions.current = null;
    if (!previous || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stripRef.current?.querySelectorAll<HTMLElement>("[data-tab-id], [data-group-tab]").forEach((element) => {
      const id = element.dataset.tabId ?? element.dataset.groupTab!;
      if (id === dragRef.current?.id) return;
      const oldLeft = previous.get(id);
      if (oldLeft === undefined) return;
      const delta = oldLeft - element.offsetLeft;
      if (delta) {
        element.getAnimations().filter((animation) => animation.id === "tab-reorder").forEach((animation) => animation.cancel());
        element.animate([{ transform: `translateX(${delta}px)` }, { transform: "translateX(0)" }], { id: "tab-reorder", duration: 120, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    });
  }, [tabs, brandTabs]);
  const startTabDrag = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button") || closingTab) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { id, startX: event.clientX, lastX: event.clientX, moved: false, offsetX: event.clientX - rect.left, top: rect.top, width: rect.width, height: rect.height };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTabDrag = (event: { clientX: number; clientY: number }) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < 5) return;
    if (!drag.moved && tabGroups[drag.id]?.expanded) {
      restoreExpandedAfterDrag.current = drag.id;
      updateGroup(drag.id, (group) => ({ ...group, expanded: false }));
      drag.width = stripRef.current?.querySelector<HTMLElement>(`[data-tab-id="${drag.id}"] .brand-group-heading`)?.offsetWidth ?? 102;
      drag.offsetX = Math.min(drag.offsetX, drag.width);
    }
    const direction = Math.sign(event.clientX - drag.lastX);
    drag.lastX = event.clientX;
    drag.moved = true;
    suppressClick.current = true;
    setSelectedTab(drag.id);
    setDraggedTab(drag.id);
    const dragLeft = Math.max(0, Math.min(window.innerWidth - drag.width, event.clientX - drag.offsetX));
    const dragRight = dragLeft + drag.width;
    const dragCenter = dragLeft + drag.width / 2;
    setDragPreview({ left: dragLeft, top: drag.top, width: drag.width, height: drag.height, borderRadius: 999 });
    const groupElements = Array.from(stripRef.current?.querySelectorAll<HTMLElement>(".brand-group-shell") ?? []);
    const sourceGroup = groupElements.find((element) => tabGroups[element.dataset.tabId!].tabs.some((tab) => tab.id === drag.id));
    const group = sourceGroup ?? groupElements.find((element) => {
      if (!tabGroups[element.dataset.tabId!].expanded) return false;
      const bounds = element.getBoundingClientRect();
      return dragRight > bounds.left && dragLeft < bounds.right;
    });
    const groupId = group?.dataset.tabId ?? BRAND_GROUP_ID;
    const brandTabs = tabGroups[groupId]?.tabs ?? [];
    const groupExpanded = tabGroups[groupId]?.expanded ?? false;
    const setBrandTabs = (update: (current: DemoGroup["tabs"]) => DemoGroup["tabs"]) => updateGroup(groupId, (current) => ({ ...current, tabs: update(current.tabs) }));
    const setGroupExpanded = (expanded: boolean) => updateGroup(groupId, (current) => ({ ...current, expanded }));
    const inside = brandTabs.some((tab) => tab.id === drag.id);
    setGroupDropTarget(inside && drag.id !== BRAND_GROUP_ID);
    if (!group) {
      setAttachmentGroup(null);
      setGroupAttachment({ left: 0, right: 0 });
    }
    if (!isTabGroup(drag.id) && group) {
      const bounds = group.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(dragRight, bounds.right) - Math.max(dragLeft, bounds.left));
      const movingIntoGroup = direction > 0 ? dragCenter < bounds.left + bounds.width / 2 : direction < 0 && dragCenter > bounds.left + bounds.width / 2;
      const overGroup = movingIntoGroup && overlap >= drag.width / 3 && event.clientY > bounds.top - 12 && event.clientY < bounds.bottom + 12;
      const attaching = inside || (movingIntoGroup && overlap > 0 && event.clientY > bounds.top - 12 && event.clientY < bounds.bottom + 12);
      setAttachmentGroup(attaching ? groupId : null);
      const children = Array.from(group.querySelectorAll<HTMLElement>("[data-group-tab]"));
      // The hidden source slot must not hold the group's trailing edge open.
      const headingRight = group.querySelector<HTMLElement>(".brand-group-heading")!.getBoundingClientRect().right;
      const visibleRight = Math.max(headingRight, ...children.filter((element) => element.dataset.groupTab !== drag.id).map((element) => element.getBoundingClientRect().right));
      const attachedRight = inside ? Math.max(visibleRight, dragRight) + 2 - bounds.right : Math.max(0, dragRight - bounds.right);
      setGroupAttachment(attaching ? { left: Math.max(0, bounds.left - dragLeft), right: attachedRight } : { left: 0, right: 0 });
      const canTransfer = performance.now() - (drag.membershipChangedAt ?? -1000) > 160;
      if (!inside && overGroup && canTransfer) {
        const insertAt = groupExpanded ? children.filter((element) => {
          const parentLeft = element.offsetParent?.getBoundingClientRect().left ?? 0;
          return event.clientX > parentLeft + element.offsetLeft + element.offsetWidth / 2;
        }).length : brandTabs.length;
        drag.membershipChangedAt = performance.now();
        setTabs((current) => current.filter((id) => id !== drag.id));
        setBrandTabs((current) => { if (current.some((tab) => tab.id === drag.id)) return current; const next = [...current]; next.splice(insertAt, 0, { id: drag.id, title: titleFor(drag.id) }); return next; });
        setGroupDropTarget(true);
        setGroupAttachment({ left: Math.max(0, bounds.left - dragLeft), right: Math.max(0, dragRight - bounds.right) });
        setGroupExpanded(true);
        return;
      }
      if (inside) {
        if (canTransfer && (dragLeft < bounds.left - drag.width / 3 || dragRight > bounds.right + drag.width / 3 || event.clientY < bounds.top - 32 || event.clientY > bounds.bottom + 32)) {
          const topItems = Array.from(stripRef.current!.querySelectorAll<HTMLElement>("[data-tab-id]"));
          const insertAt = topItems.filter((element) => {
            const rect = element.getBoundingClientRect();
            return event.clientX > rect.left + rect.width / 2;
          }).length;
          drag.membershipChangedAt = performance.now();
          setBrandTabs((current) => current.filter((tab) => tab.id !== drag.id));
          const emptyGroup = brandTabs.length === 1;
          setTabs((current) => {
            if (current.includes(drag.id)) return current;
            const next = [...current];
            next.splice(insertAt, 0, drag.id);
            return emptyGroup ? next.filter((id) => id !== groupId) : next;
          });
          if (emptyGroup) setGroupExpanded(false);
          setGroupDropTarget(false);
          setGroupAttachment({ left: 0, right: 0 });
          return;
        }
        const from = brandTabs.findIndex((tab) => tab.id === drag.id);
        let to = from;
        children.forEach((element, index) => {
          const parentLeft = element.offsetParent?.getBoundingClientRect().left ?? 0;
          const center = parentLeft + element.offsetLeft + element.offsetWidth / 2;
          if (direction > 0 && index > from && dragRight > center) to = Math.max(to, index);
          if (direction < 0 && index < from && dragLeft < center) to = Math.min(to, index);
        });
        if (to !== from) {
          previousTabPositions.current = new Map(children.map((element) => [element.dataset.groupTab!, element.offsetLeft]));
          setBrandTabs((current) => { const next = [...current]; const source = next.findIndex((tab) => tab.id === drag.id); const [item] = next.splice(source, 1); next.splice(to, 0, item); return next; });
        }
        return;
      }
    }
    const elements = stripRef.current?.querySelectorAll<HTMLElement>("[data-tab-id]");
    if (!elements) return;
    const from = tabs.indexOf(drag.id);
    let to = from;
    elements.forEach((element, index) => {
      if (index === from) return;
      const trackLeft = element.offsetParent?.getBoundingClientRect().left ?? 0;
      const center = trackLeft + element.offsetLeft + element.offsetWidth / 2;
      // Expanded groups accept tabs; collapsed groups use normal reorder thresholds.
      if (!isTabGroup(drag.id) && tabGroups[element.dataset.tabId!]?.expanded) {
        const left = trackLeft + element.offsetLeft;
        if (direction < 0 && dragCenter >= left) return;
        if (direction > 0 && dragCenter <= left + element.offsetWidth) return;
      }
      if (direction > 0 && index > from && dragRight > center) to = Math.max(to, index);
      if (direction < 0 && index < from && dragLeft < center) to = Math.min(to, index);
    });
    if (to !== from) {
      previousTabPositions.current = new Map(Array.from(elements, (element) => [element.dataset.tabId!, element.offsetLeft]));
      setTabs((current) => {
      const next = [...current];
      const source = next.indexOf(drag.id);
      next.splice(source, 1);
      next.splice(to, 0, drag.id);
      return next;
      });
    }
  };
  const endTabDrag = () => {
    if (restoreExpandedAfterDrag.current) {
      updateGroup(restoreExpandedAfterDrag.current, (group) => ({ ...group, expanded: true }));
      restoreExpandedAfterDrag.current = null;
    }
    dragRef.current = null; setDraggedTab(null); setDragPreview(null); setGroupDropTarget(false);
    setGroupAttachment({ left: 0, right: 0 });
    setAttachmentGroup(null);
  };
  useEffect(() => {
    if (!active) return;
    window.addEventListener("pointermove", moveTabDrag);
    window.addEventListener("pointerup", endTabDrag);
    window.addEventListener("pointercancel", endTabDrag);
    window.addEventListener("blur", endTabDrag);
    return () => {
      window.removeEventListener("pointermove", moveTabDrag);
      window.removeEventListener("pointerup", endTabDrag);
      window.removeEventListener("pointercancel", endTabDrag);
      window.removeEventListener("blur", endTabDrag);
    };
  }, [tabs, tabGroups, active]);
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    // Measure the stable available space, not the track that grows with tabs.
    const update = () => {
      const measuredGroup = Array.from(strip.querySelectorAll<HTMLElement>(".brand-group-shell")).reduce((width, element) => width + element.offsetWidth, 0);
      const measuredHeadings = Array.from(strip.querySelectorAll<HTMLElement>(".brand-group-heading")).reduce((width, element) => width + element.offsetWidth, 0);
      setTrackCapacity(Math.max(0, strip.clientWidth - 34));
      setGroupWidth(measuredGroup);
      setGroupHeadingWidth(measuredHeadings);
    };
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    strip.querySelectorAll<HTMLElement>(".brand-group-shell").forEach((group) => observer.observe(group));
    strip.querySelectorAll<HTMLElement>(".brand-group-heading").forEach((heading) => observer.observe(heading));
    update();
    return () => observer.disconnect();
  }, [groupIds.join(",")]);
  const expandedGroups = groupIds.map((id) => tabGroups[id]).filter((group) => group.expanded);
  const visibleGroupCount = expandedGroups.reduce((count, group) => count + group.tabs.length, 0);
  const visibleTabCount = tabCount + visibleGroupCount;
  const groupGaps = expandedGroups.reduce((gaps, group) => gaps + group.tabs.length * 2 + GROUP_DIVIDER_SPACE, 0);
  const outerGapCount = Math.max(0, tabs.length - 1);
  const tabGap = Math.min(4, Math.max(0, (trackCapacity - groupHeadingWidth - groupGaps - 64 - Math.max(0, visibleTabCount - 1) * 24) / Math.max(1, outerGapCount)));
  const availableTabWidth = Math.max(0, trackCapacity - groupHeadingWidth - groupGaps - outerGapCount * tabGap);
  const regularWidth = visibleTabCount ? Math.min(172, availableTabWidth / visibleTabCount) : 0;
  const activeWidth = draggedTab && !isTabGroup(draggedTab) && dragRef.current && !dragRef.current.membershipChangedAt ? dragRef.current.width : Math.max(64, regularWidth);
  const hasVisibleActiveTab = normalTabs.includes(selectedTab) || expandedGroups.some((group) => group.tabs.some((tab) => tab.id === selectedTab));
  const inactiveWidth = hasVisibleActiveTab && visibleTabCount > 1 ? Math.min(172, Math.max(0, (availableTabWidth - activeWidth) / (visibleTabCount - 1))) : regularWidth;
  const widthForTab = (id: string) => selectedTab === id ? activeWidth : inactiveWidth;
  const groupDragOffset = draggedTab && brandTabs.some((tab) => tab.id === draggedTab) ? groupAttachment.right : 0;
  useLayoutEffect(() => {
    const drag = dragRef.current;
    if (!drag?.moved || !drag.membershipChangedAt || isTabGroup(drag.id)) return;
    const height = brandTabs.some((tab) => tab.id === drag.id) ? 28 : 32;
    const width = widthForTab(drag.id);
    if (drag.width === width && drag.height === height) return;
    drag.offsetX *= width / Math.max(1, drag.width);
    drag.top += (drag.height - height) / 2;
    drag.width = width;
    drag.height = height;
    setDragPreview({ left: Math.max(0, Math.min(window.innerWidth - width, drag.lastX - drag.offsetX)), top: drag.top, width, height, borderRadius: 999 });
  }, [tabs, brandTabs, activeWidth]);
  const addTab = () => {
    setClosingLayout(false);
    const id = crypto.randomUUID();
    setTabs((current) => [...current, id]);
    setEnteringTabs((current) => new Set(current).add(id));
    setSelectedTab(id);
    window.dispatchEvent(new Event('tabbit-new-session'));
  };
  const closeTab = (id: string) => {
    if (isTabGroup(id)) {
      const firstTab = tabGroups[id]?.tabs[0];
      if (firstTab) {
        updateGroup(id, (group) => ({ ...group, expanded: true }));
        setSelectedTab(firstTab.id);
      }
      return;
    }
    const groupId = groupIds.find((groupId) => tabGroups[groupId].tabs.some((tab) => tab.id === id));
    if (groupId) {
      const children = tabGroups[groupId].tabs;
      const index = children.findIndex((tab) => tab.id === id);
      const remaining = children.filter((tab) => tab.id !== id);
      updateGroup(groupId, (group) => ({ ...group, tabs: remaining, expanded: remaining.length ? group.expanded : false }));
      if (!remaining.length) {
        const groupIndex = tabs.indexOf(groupId);
        const remainingItems = tabs.filter((item) => item !== groupId);
        setTabs(remainingItems);
        if (selectedTab === id || selectedTab === groupId) setSelectedTab(remainingItems[Math.min(groupIndex, remainingItems.length - 1)] ?? "");
      } else if (selectedTab === id) {
        setSelectedTab(remaining[Math.min(index, remaining.length - 1)].id);
      }
      return;
    }
    if (closingTab || isTabGroup(id) || !tabs.includes(id)) return;
    setClosingLayout(true);
    setClosingTab(id);
  };
  const finishClose = (id: string) => {
    const index = normalTabs.indexOf(id);
    const remaining = tabs.filter((tab) => tab !== id);
    setTabs(remaining);
    const remainingTabs = remaining.filter((tab) => !isTabGroup(tab));
    if (selectedTab === id) setSelectedTab(remainingTabs[Math.min(index, remainingTabs.length - 1)] ?? remaining[0] ?? "");
    setClosingTab(null);
  };
  useEffect(() => {
    if (!active) return;
    const closeCurrent = () => closeTab(selectedTab);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        closeCurrent();
      }
    };
    window.addEventListener("tabbit-close-tab", closeCurrent);
    // The native menu owns Cmd+W in Tauri; the key handler supports web preview.
    if (!("__TAURI_INTERNALS__" in window)) window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("tabbit-close-tab", closeCurrent);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [tabs, selectedTab, closingTab, brandTabs, active]);
  const renderBrandGroup = (id: string) => {
    const { tabs: brandTabs, expanded: groupExpanded, label, color } = tabGroups[id];
    const groupTabsWidth = groupExpanded ? brandTabs.reduce((width, tab) => width + widthForTab(tab.id) + 2, GROUP_DIVIDER_SPACE) : 0;
    const groupDragOffset = attachmentGroup === id && draggedTab && brandTabs.some((tab) => tab.id === draggedTab) ? groupAttachment.right : 0;
    return <div key={id} className={`collapsed-group-chip brand-group-shell ${draggedTab && attachmentGroup === id ? "is-attached" : ""} ${selectedTab === id ? "active" : ""}`} style={{ marginRight: groupDragOffset, "--attach-left": `${attachmentGroup === id ? groupAttachment.left : 0}px`, "--attach-right": `${attachmentGroup === id ? groupAttachment.right : 0}px` } as React.CSSProperties} data-tab-id={id} data-drop-target={groupDropTarget || undefined} data-dragging={draggedTab === id || undefined} onPointerDown={(event) => startTabDrag(event, id)} onPointerUp={endTabDrag} onPointerCancel={endTabDrag} onClick={(event) => { if ((event.target as HTMLElement).closest("button, [data-group-tab]")) return; if (suppressClick.current) { suppressClick.current = false; return; } setSelectedTab(id); }}>
    <div className={`brand-group-heading ${selectedTab === id ? "active" : ""}`} role="button" aria-pressed={selectedTab === id} tabIndex={0} aria-label={`${label}标签组`} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setSelectedTab(id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedTab(id); } }}>
      <CollapsedBrandContent label={label} color={color} expanded={groupExpanded} onToggle={() => updateGroup(id, (group) => ({ ...group, expanded: !group.expanded }))}/>
    </div>
    <div className={`brand-group-tabs ${groupExpanded ? "expanded" : ""}`} style={{ width: groupTabsWidth }} inert={!groupExpanded} aria-hidden={!groupExpanded}>
      <div className="brand-group-tabs-inner">
        <span className="brand-group-divider" aria-hidden="true"/>
        {brandTabs.map((tab) => <div key={tab.id} data-group-tab={tab.id} style={{ width: widthForTab(tab.id), flexBasis: widthForTab(tab.id) }} data-dragging={draggedTab === tab.id || undefined} className={`horizontal-tab grouped-tab ${widthForTab(tab.id) < 96 ? "compact" : ""} ${widthForTab(tab.id) < 64 ? "dense" : ""} ${selectedTab === tab.id ? "active" : ""}`} role="tab" aria-label={tab.title} aria-selected={selectedTab === tab.id} tabIndex={0} onPointerDown={(event) => { event.stopPropagation(); startTabDrag(event, tab.id); }} onPointerUp={endTabDrag} onPointerCancel={endTabDrag} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setSelectedTab(tab.id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedTab(tab.id); } }}>
          <span className="tab-content"><TabFavicon id={tab.id}/><span className="tab-title">{tab.title}</span></span>
          <button className="tab-close" aria-label={`关闭${tab.title}`} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><IconFont name="cha-x" className="tab-close-icon"/></button>
        </div>)}
      </div>
    </div>
  </div>;
  };
  return <>
    <div className="tab-strip" ref={stripRef} data-tauri-drag-region>
      <div className={`tab-viewport ${draggedTab ? "is-dragging" : ""} ${closingLayout ? "tab-layout-closing" : ""}`} role="tablist" aria-label="标签页" data-tauri-drag-region style={{ gap: tabGap, width: groupWidth + groupDragOffset + normalTabs.reduce((width, id) => width + widthForTab(id), 0) + outerGapCount * tabGap, "--tab-gap": `${tabGap}px` } as React.CSSProperties}>
      {tabs.map((id, index) => { if (isTabGroup(id)) return renderBrandGroup(id); const width = widthForTab(id); return <div key={id} data-tab-id={id} data-dragging={draggedTab === id || undefined} onPointerDown={(event) => startTabDrag(event, id)} onPointerUp={endTabDrag} onPointerCancel={endTabDrag} style={{ width }} title={`${titleFor(id)} · ${index + 1}`} className={`horizontal-tab new-tab ${selectedTab === id ? "active" : ""} ${width < 96 ? "compact" : ""} ${width < 64 ? "dense" : ""} ${enteringTabs.has(id) ? "tab-entering" : ""} ${closingTab === id ? "tab-closing" : ""}`} onAnimationEnd={(event) => { if (event.target !== event.currentTarget) return; if (event.animationName === "tab-close") finishClose(id); if (event.animationName === "tab-open") setEnteringTabs((current) => { const next = new Set(current); next.delete(id); return next; }); }} role="tab" aria-label={`${titleFor(id)} ${index + 1}`} aria-selected={selectedTab === id} tabIndex={0} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setSelectedTab(id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedTab(id); } }}>
        <span className="tab-content"><TabFavicon id={id}/><span className="tab-title">{titleFor(id)}</span></span>
        <button className="tab-close" aria-label="关闭标签页" onClick={(event) => { event.stopPropagation(); closeTab(id); }}><IconFont name="cha-x" className="tab-close-icon"/></button>
      </div>})}
      </div>
      <button className="add-tab" aria-label="新标签页" onClick={addTab}><IconFont name="jiahao"/></button>
    </div><button className="window-chevron" aria-label="所有标签页" aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}><IconFont name="jiantou-v-xiangxia"/></button>
    {listOpen && <><div className="tab-list-dismiss" onClick={() => setListOpen(false)}/><DropdownPanel className="tab-list-panel" label="所有标签页" onClose={() => setListOpen(false)}><div className="tab-list-heading">所有标签页 <span>{normalTabs.length}</span></div>{normalTabs.map((id, index) => <button key={id} className={selectedTab === id ? "selected" : ""} onClick={() => { setSelectedTab(id); setListOpen(false); }}><TabFavicon id={id} className="tab-list-icon"/><span>{titleFor(id)}</span><span className="tab-list-number">{index + 1}</span>{selectedTab === id && <span>✓</span>}</button>)}</DropdownPanel></>}
    {dragPreview && <div className={`tab-drag-preview ${draggedTab && isTabGroup(draggedTab) ? "group-drag-preview" : ""}`} style={dragPreview} aria-hidden="true">{draggedTab && isTabGroup(draggedTab) ? <CollapsedBrandContent label={tabGroups[draggedTab].label} color={tabGroups[draggedTab].color}/> : <><TabFavicon id={draggedTab ?? ""}/><span>{titleFor(draggedTab ?? "")}</span></>}</div>}
  </>;
}

function groupLineColor(color:string) {
  const token = /^var\(--color-([a-z]+)-\d+\)$/.exec(color);
  if (token) return `var(--color-${token[1]}-6)`;
  const hex = /^#([a-f0-9]{6})$/i.exec(color);
  if (!hex) return color;
  const value = parseInt(hex[1], 16);
  const rgb = [value >> 16, (value >> 8) & 255, value & 255];
  const palette: [string, number[]][] = [['blue',[0,140,255]],['red',[255,59,65]],['orange',[255,137,40]],['yellow',[255,191,0]],['green',[100,194,63]],['cyan',[0,199,209]],['purple',[152,71,255]]];
  const nearest = palette.reduce((best, item) => {
    const distance = (entry:typeof item) => entry[1].reduce((sum, channel, index) => sum + (channel - rgb[index]) ** 2, 0);
    return distance(item) < distance(best) ? item : best;
  });
  return `var(--color-${nearest[0]}-6)`;
}

const VerticalTabPreview = memo(function VerticalTabPreview({ spaceId, activeTab }: {spaceId:number; activeTab:string}) {
  const seed = SPACE_TABS[spaceId];
  const layout = spaceTabLayouts.get(spaceId) ?? { tabs:initialSpaceTabs(spaceId), groups:seed.groups };
  const titles = Object.fromEntries([...seed.loose, ...Object.values(layout.groups).flatMap(group => group.tabs)].map(tab => [tab.id, tab.title]));
  const row = (id:string) => <div key={id} className={`vertical-tab ${activeTab === id ? "active" : ""}`}><span className="tab-content"><TabFavicon id={id}/><span className="tab-title">{titles[id] ?? "New Tab"}</span></span></div>;
  return <div className="vertical-tabs-region"><div className="vertical-tab-viewport"><div className="vertical-preview-list group-list">{layout.tabs.map(id => {
    if (!isTabGroup(id)) return row(id);
    const group = layout.groups[id];
    if (!group) return null;
    return <div className="vertical-group" key={id} style={{"--group-line-color":groupLineColor(group.color)} as React.CSSProperties}>
      <div className={`vertical-group-title ${activeTab === id ? "active" : ""}`}><div className="vertical-group-select"><span className="collapsed-group-marker"><span className="collapsed-group-dot" style={{background:group.color}}/></span><span className="tab-title">{group.label}</span></div><div className="vertical-group-toggle" aria-expanded={group.expanded}><span className="vertical-group-count">{group.tabs.length}</span><IconFont name="jiantou-v-xiangxia"/></div></div>
      {group.expanded && <div className="vertical-group-tabs">{group.tabs.map(tab => row(tab.id))}</div>}
    </div>;
  })}</div></div><button className="sidebar-new-tab" tabIndex={-1}><IconFont name="jiahao"/>新标签页</button></div>;
});

const VerticalSidebar = memo(function VerticalSidebar({ activeTab, onTab, spaceId, collapsed }: { activeTab:string; onTab:(spaceId:number,id:string)=>void; spaceId:number; collapsed:boolean }) {
  const seed = SPACE_TABS[spaceId];
  const [layouts, setLayouts] = useState(() => new Map<number, { tabs:string[]; groups:Record<string, DemoGroup> }>());
  const layout = layouts.get(spaceId) ?? spaceTabLayouts.get(spaceId) ?? { tabs:initialSpaceTabs(spaceId), groups:seed.groups };
  const tabs = layout.tabs;
  const tabGroups = layout.groups;
  const updateLayout = (update:(current:{ tabs:string[]; groups:Record<string, DemoGroup> })=>{ tabs:string[]; groups:Record<string, DemoGroup> }) => {
    setLayouts(current => {
      const next = new Map(current);
      const active = next.get(spaceId) ?? spaceTabLayouts.get(spaceId) ?? { tabs:initialSpaceTabs(spaceId), groups:SPACE_TABS[spaceId].groups };
      next.set(spaceId, update(active));
      return next;
    });
  };
  const setTabs = (update:string[] | ((current:string[])=>string[])) => updateLayout(current => ({ ...current, tabs:typeof update === 'function' ? update(current.tabs) : update }));
  const setTabGroups = (update:Record<string, DemoGroup> | ((current:Record<string, DemoGroup>)=>Record<string, DemoGroup>)) => updateLayout(current => ({ ...current, groups:typeof update === 'function' ? update(current.groups) : update }));
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const [listOverflow, setListOverflow] = useState(false);

  const [activeOutside, setActiveOutside] = useState<"above" | "below" | null>(null);
  const pendingLocate = useRef(false);
  const pendingNewTab = useRef<string | null>(null);
  useEffect(() => { setQuery(""); }, [spaceId]);
  function selectedElement() {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>(".vertical-tab.active,.vertical-group-title.active");
    if (selected?.closest('.vertical-group-collapse[data-expanded="false"]')) return selected.closest('.vertical-group')?.querySelector<HTMLElement>('.vertical-group-title') ?? null;
    return selected ?? null;
  }
  function scrollToSelected() {
    const list = listRef.current;
    const selected = selectedElement();
    if (!list || !selected) return;
    const rect = selected.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    list.scrollTo({ top:list.scrollTop + rect.top - viewport.top - (list.clientHeight - rect.height) / 2, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function locateSelected() {
    const group = Object.entries(tabGroups).find(([, value]) => value.tabs.some(tab => tab.id === activeTab));
    if (group && !group[1].expanded) {
      pendingLocate.current = true;
      setTabGroups(current => ({ ...current, [group[0]]:{ ...current[group[0]], expanded:true } }));
    } else scrollToSelected();
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      setListOverflow(list.scrollHeight > list.clientHeight + 1);
      // Clip group contents below their sticky heading, without adding a fill.
      list.querySelectorAll<HTMLElement>(".vertical-group").forEach(group => {
        const heading = group.querySelector<HTMLElement>(".vertical-group-title");
        const body = group.querySelector<HTMLElement>(".vertical-group-collapse");
        if (!heading || !body) return;
        const rect = body.getBoundingClientRect();
        const clip = Math.max(0, Math.min(rect.height, heading.getBoundingClientRect().bottom - rect.top));
        body.style.setProperty("--sticky-heading-clip", `${clip}px`);
      });
      const target = selectedElement();
      if (!target || collapsed) { setActiveOutside(null); return; }
      const viewport = list.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      if (pendingNewTab.current === activeTab) {
        if (rect.bottom > viewport.bottom - 6) list.scrollTop += rect.bottom - viewport.bottom + 6;
        else if (rect.top < viewport.top + 6) list.scrollTop += rect.top - viewport.top - 6;
      }
      const visibleRect = target.getBoundingClientRect();
      setActiveOutside(visibleRect.top < viewport.top - 1 ? "above" : visibleRect.bottom > viewport.bottom + 1 ? "below" : null);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    [...list.children].forEach(child => observer.observe(child));
    list.addEventListener("scroll", measure, { passive:true });
    measure();
    let frame = 0;
    if (pendingLocate.current) { pendingLocate.current = false; frame = requestAnimationFrame(scrollToSelected); }
    // Recheck while a newly opened group is animating to its final height.
    const revealTimer = pendingNewTab.current === activeTab ? window.setTimeout(() => { measure(); pendingNewTab.current = null; }, 250) : undefined;
    return () => { observer.disconnect(); list.removeEventListener("scroll", measure); cancelAnimationFrame(frame); window.clearTimeout(revealTimer); };
  }, [tabs, tabGroups, query, collapsed, activeTab]);

  const titles = useMemo(() => Object.fromEntries([...seed.loose, ...Object.values(tabGroups).flatMap(group => group.tabs)].map(tab => [tab.id, tab.title])), [seed, tabGroups]);
  const titleFor = (id:string) => titles[id] ?? "New Tab";
  useLayoutEffect(() => { spaceTabLayouts.set(spaceId, { tabs, groups:tabGroups }); }, [tabs, tabGroups, spaceId]);
  function toggle(id:string) { setTabGroups(current => ({ ...current, [id]:{ ...current[id], expanded:!current[id].expanded } })); }
  const selectTab = (id:string) => onTab(spaceId, id);
  function addTab() { const id = crypto.randomUUID(); pendingNewTab.current = id; setTabs(current => [...current, id]); selectTab(id); window.dispatchEvent(new Event('tabbit-new-session')); }

  function addGroupTab(groupId:string) {
    const id = crypto.randomUUID();
    pendingNewTab.current = id;
    setTabGroups(current => ({ ...current, [groupId]:{ ...current[groupId], expanded:true, tabs:[...current[groupId].tabs, {id, title:"New Tab"}] } }));
    selectTab(id);
    window.dispatchEvent(new Event('tabbit-new-session'));
  }
  function closeTab(id:string) {
    if (isTabGroup(id)) {
      const first = tabGroups[id]?.tabs[0];
      if (first) { setTabGroups(current => ({ ...current, [id]:{ ...current[id], expanded:true } })); selectTab(first.id); }
      return;
    }
    const nextGroups = Object.fromEntries(Object.entries(tabGroups).map(([key, group]) => [key, { ...group, tabs:group.tabs.filter(tab => tab.id !== id) }]).filter(([, group]) => (group as DemoGroup).tabs.length)) as Record<string, DemoGroup>;
    const all = tabs.flatMap(key => isTabGroup(key) ? tabGroups[key]?.tabs.map(tab => tab.id) ?? [] : [key]);
    const remaining = tabs.filter(key => key !== id && (!isTabGroup(key) || nextGroups[key]));
    setTabGroups(nextGroups); setTabs(remaining);
    if (activeTab === id) { const rest = all.filter(key => key !== id); selectTab(rest[Math.min(all.indexOf(id), rest.length - 1)] ?? remaining[0] ?? ""); }
  }
  useEffect(() => {
    const close = () => closeTab(activeTab);
    const key = (event:KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w" && !event.shiftKey && !event.altKey) { event.preventDefault(); close(); }
    };
    const all = (event:Event) => {
      const detail = (event as CustomEvent<{spaceId:number; expanded:boolean}>).detail;
      if (detail.spaceId === spaceId) setTabGroups(current => Object.fromEntries(Object.entries(current).map(([id, group]) => [id, { ...group, expanded:detail.expanded }])));
    };
    window.addEventListener("tabbit-close-tab", close);
    window.addEventListener("tabbit-set-all-groups", all);
    if (!("__TAURI_INTERNALS__" in window)) window.addEventListener("keydown", key);
    return () => { window.removeEventListener("tabbit-close-tab", close); window.removeEventListener("tabbit-set-all-groups", all); window.removeEventListener("keydown", key); };
  }, [activeTab, tabs, tabGroups, spaceId]);
  const matches = (id:string) => titleFor(id).toLowerCase().includes(query.trim().toLowerCase());
  const row = (id:string) => <div key={id} className={`vertical-tab ${activeTab === id ? "active" : ""}`} role="tab" aria-selected={activeTab === id} tabIndex={0} onClick={() => selectTab(id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectTab(id); } }}>
    <span className="tab-content"><TabFavicon id={id}/><span className="tab-title">{titleFor(id)}</span></span>
    <button className="tab-close" aria-label={`关闭 ${titleFor(id)}`} onClick={event => { event.stopPropagation(); closeTab(id); }}><IconFont name="cha-x"/></button>
  </div>;
  return <aside className="vertical-sidebar" data-tauri-drag-region inert={collapsed} aria-hidden={collapsed || undefined}>
    <div className="sidebar-search-area" data-tauri-drag-region><label className="sidebar-search"><span className="sidebar-search-leading"><IconFont name="sousuo"/><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标签页" aria-label="搜索标签页"/></span></label></div>
    <div className="vertical-tabs-region" data-overflow={listOverflow} data-tauri-drag-region>
    <div className="vertical-tab-viewport" data-tauri-drag-region>
    <div className="group-list" ref={listRef} data-overflow={listOverflow} data-tauri-drag-region role="tablist" aria-label="垂直标签页">
      {tabs.map(id => {
        if (!isTabGroup(id)) return matches(id) ? row(id) : null;
        const group = tabGroups[id];
        if (!group) return null;
        const children = group.tabs.filter(tab => matches(tab.id));
        if (query && !children.length && !group.label.toLowerCase().includes(query.toLowerCase())) return null;
        const expanded = group.expanded || !!query;
        return <div className="vertical-group" key={id} data-group-id={id} style={{ "--group-color":group.color, "--group-line-color":groupLineColor(group.color) } as React.CSSProperties}>
          <div className={`vertical-group-title ${activeTab === id ? "active" : ""}`}>
            <button className="vertical-group-select" onClick={() => selectTab(id)}><span className="collapsed-group-marker"><span className="collapsed-group-dot" style={{background:group.color}}/></span><span className="tab-title">{group.label}</span></button>
            <button className="vertical-group-add" aria-label={`在${group.label}中新建标签页`} onClick={() => addGroupTab(id)}><IconFont name="jiahao"/></button>
            <button className="vertical-group-toggle" aria-label={`${expanded ? "收起" : "展开"}${group.label}`} aria-expanded={expanded} onClick={() => toggle(id)}><span className="vertical-group-count">{group.tabs.length}</span><IconFont name="jiantou-v-xiangxia"/></button>
          </div>
          <div className="vertical-group-collapse" data-tauri-drag-region data-expanded={expanded} inert={!expanded}><div className="vertical-group-tabs" data-tauri-drag-region>{children.map(tab => row(tab.id))}</div></div>
        </div>;
      })}
    </div>
    {activeOutside && <button className={`vertical-active-locator is-${activeOutside}`} aria-label="定位当前标签页" onClick={locateSelected}><IconFont name="nav-back"/></button>}
    </div>
    <button className="sidebar-new-tab" onClick={addTab}><IconFont name="jiahao"/>新标签页</button>
    </div>
  </aside>;
});

function App() {
  const [selectedSpace, selectSpace] = useState(0);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const nativeMenu = false;
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

  return <SpaceContext.Provider value={{ selectedSpace, selectSpace, visibleSpaceIds, spaces: spaceAppearances }}><main className={`glass-surface mode-${mode} ${verticalCollapsed ? "vertical-collapsed" : ""}`} onClick={() => setMenuOpen(false)}><div className="container-fill" aria-hidden="true"/><div className="browser-window">
    {mode === "horizontal" ? <><HorizontalTabs spaceId={selectedSpace} onSpace={showSpaceMenu} selectedTab={activeTab} setSelectedTab={setActiveTab}/><div className="horizontal-browser"><WindowToolbar isNewTab={isNewTab} tabId={activeTab}/><BrowserContent isNewTab={isNewTab}>{isTabGroup(activeTab) ? <section className="group-page"><h1><span className="collapsed-group-dot" style={{ background: SPACE_TABS[selectedSpace].groups[activeTab]?.color }}/>{SPACE_TABS[selectedSpace].groups[activeTab]?.label}</h1></section> : <section className="website-demo-page"/>}</BrowserContent></div></>
      : <><div className="vertical-topbar" data-tauri-drag-region><WindowToolbar isNewTab={isNewTab} tabId={activeTab} showBookmarks={false} leading={<div className="vertical-topbar-controls"><button className="vertical-mode-toggle" aria-label={verticalCollapsed ? "展开垂直标签栏" : "收起垂直标签栏"} aria-expanded={!verticalCollapsed} onClick={() => setVerticalCollapsed(value => !value)}><VerticalToggleIcon/></button><button className="vertical-space-entry" aria-label="空间菜单" onClick={event => {event.stopPropagation(); showSpaceMenu(); }}><OrganizeTabsMark/></button></div>}/></div><VerticalSpaceSwipe renderPreview={id => <VerticalTabPreview spaceId={id} activeTab={activeTabs[id] ?? initialSpaceTab(id)}/>} spaces={spaceAppearances} spaceId={selectedSpace} spaceIds={visibleSpaceIds} onSelect={selectSpace} collapsed={verticalCollapsed}><div className="vertical-sidebar-stack">{visibleSpaceIds.map(id => <div key={id} className="vertical-space-sidebar-layer" hidden={id !== selectedSpace} inert={id !== selectedSpace}><VerticalSidebar spaceId={id} activeTab={activeTabs[id] ?? initialSpaceTab(id)} onTab={setVerticalActiveTab} collapsed={verticalCollapsed}/></div>)}</div></VerticalSpaceSwipe><VerticalSidebarResizeHandle collapsed={verticalCollapsed}/><div className="vertical-browser-container"><div className="vertical-browser"><BookmarksRow/><BrowserContent isNewTab={isNewTab}>{isTabGroup(activeTab) ? <section className="group-page"><h1><span className="collapsed-group-dot" style={{background:spaceTabLayouts.get(selectedSpace)?.groups[activeTab]?.color ?? SPACE_TABS[selectedSpace].groups[activeTab]?.color}}/>{spaceTabLayouts.get(selectedSpace)?.groups[activeTab]?.label ?? SPACE_TABS[selectedSpace].groups[activeTab]?.label}</h1></section> : <section className="website-demo-page"/>}</BrowserContent></div></div></>}
    {menuOpen && !nativeMenu && <SpaceMenu mode={mode} onMode={changeMode} onClose={() => setMenuOpen(false)} setAll={setAllGroups} onCreate={() => { setMenuOpen(false); setCreateSpaceOpen(true); }} onEdit={() => { setMenuOpen(false); setEditSpaceId(selectedSpace); }} onDelete={() => { setMenuOpen(false); setDeleteSpaceId(selectedSpace); }}/>}<GlassControls key={selectedSpace} spaceId={String(selectedSpace)} spaceName={spaceAppearances[selectedSpace].name}/>{deleteSpaceId !== null && <DeleteSpaceDialog onCancel={cancelDelete} onConfirm={confirmDelete}/>}{editSpaceId !== null && <EditSpaceDialog key={editSpaceId} space={spaceAppearances[editSpaceId]} onCancel={cancelEdit} onConfirm={confirmEdit}/>}{createSpaceOpen && <CreateSpaceDialog onCancel={cancelCreate} onConfirm={confirmCreate}/>}</div></main></SpaceContext.Provider>;
}

export default App;
