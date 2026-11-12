import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconFont, TabFavicon } from './BrowserIcons';
import { INTERNAL_TAB_EVENT, SPACE_TABS, spaceTabLayouts, initialSpaceTabs, internalTabTitle, isTabGroup, type DemoGroup } from './tabs-data';

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

export const VerticalTabPreview = memo(function VerticalTabPreview({ spaceId, activeTab }: {spaceId:number; activeTab:string}) {
  const seed = SPACE_TABS[spaceId];
  const layout = spaceTabLayouts.get(spaceId) ?? { tabs:initialSpaceTabs(spaceId), groups:seed.groups };
  const titles = Object.fromEntries([...seed.loose, ...Object.values(layout.groups).flatMap(group => group.tabs)].map(tab => [tab.id, tab.title]));
  const row = (id:string) => <div key={id} className={`vertical-tab ${activeTab === id ? "active" : ""}`}><span className="tab-content"><TabFavicon id={id}/><span className="tab-title">{internalTabTitle(id) ?? titles[id] ?? "New Tab"}</span></span></div>;
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

export const VerticalSidebar = memo(function VerticalSidebar({ activeTab, onTab, spaceId, collapsed, active }: { activeTab:string; onTab:(spaceId:number,id:string)=>void; spaceId:number; collapsed:boolean; active:boolean }) {
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
  const titleFor = (id:string) => internalTabTitle(id) ?? titles[id] ?? "New Tab";
  useLayoutEffect(() => { spaceTabLayouts.set(spaceId, { tabs, groups:tabGroups }); }, [tabs, tabGroups, spaceId]);
  function toggle(id:string) { setTabGroups(current => ({ ...current, [id]:{ ...current[id], expanded:!current[id].expanded } })); }
  const selectTab = (id:string) => onTab(spaceId, id);
  function addTab() { const id = crypto.randomUUID(); pendingNewTab.current = id; setTabs(current => [...current, id]); selectTab(id); window.dispatchEvent(new Event('tabbit-new-session')); }
  useEffect(() => {
    if (!active) return;
    const openInternalTab = (event: Event) => {
      const { id } = (event as CustomEvent<{ id:string }>).detail;
      if (!id) return;
      pendingNewTab.current = id;
      setTabs(current => current.includes(id) ? current : [...current, id]);
      selectTab(id);
    };
    window.addEventListener(INTERNAL_TAB_EVENT, openInternalTab);
    return () => window.removeEventListener(INTERNAL_TAB_EVENT, openInternalTab);
  }, [active, spaceId]);

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
    const close = () => {
      if (!active || document.querySelector('dialog[open]')) return;
      closeTab(activeTab);
    };
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
  }, [active, activeTab, tabs, tabGroups, spaceId]);
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
