import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DropdownPanel from '../DropdownPanel';
import { IconFont, TabFavicon } from './BrowserIcons';
import { SpaceContainer } from './SpaceMenu';
import { BRAND_GROUP_ID, GROUP_DIVIDER_SPACE, INTERNAL_TAB_EVENT, SPACE_TABS, spaceTabLayouts, initialSpaceTabs, internalTabTitle, isTabGroup, type DemoGroup } from './tabs-data';
import { Check } from '../personalized-home-2-0/icons';

function CollapsedBrandContent({ expanded = false, onToggle, label = "品牌资源", color = "var(--color-orange-4)" }: { expanded?: boolean; onToggle?: () => void; label?: string; color?: string }) {
  const arrow = <IconFont name="jiantou-v-xiangyou"/>;
  return <><span className="collapsed-group-content"><span className="collapsed-group-marker"><span className="collapsed-group-dot" style={{ background: color }}/></span><span className="tab-title">{label}</span></span>{onToggle ? <button className={`collapsed-group-arrow ${expanded ? "expanded" : ""}`} aria-label={`${expanded ? "收起" : "展开"}${label}`} aria-expanded={expanded} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggle(); }}>{arrow}</button> : <span className="collapsed-group-arrow">{arrow}</span>}</>;
}

type HorizontalTabsProps = { onSpace: () => void; selectedTab: string; setSelectedTab: (id: string) => void; spaceId: number };
export default function HorizontalTabs({ onSpace, ...props }: HorizontalTabsProps) {
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
  const titleFor = (id: string) => internalTabTitle(id) ?? tabTitles.current[id] ?? "New Tab";
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
  useEffect(() => {
    if (!active) return;
    const openInternalTab = (event: Event) => {
      const { id, title } = (event as CustomEvent<{ id:string; title:string }>).detail;
      if (!id) return;
      tabTitles.current[id] = title || internalTabTitle(id) || "New Tab";
      setClosingLayout(false);
      setTabs((current) => current.includes(id) ? current : [...current, id]);
      setEnteringTabs((current) => current.has(id) ? current : new Set(current).add(id));
      setSelectedTab(id);
    };
    window.addEventListener(INTERNAL_TAB_EVENT, openInternalTab);
    return () => window.removeEventListener(INTERNAL_TAB_EVENT, openInternalTab);
  }, [active, setSelectedTab]);
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
    {listOpen && <><div className="tab-list-dismiss" onClick={() => setListOpen(false)}/><DropdownPanel className="tab-list-panel" label="所有标签页" onClose={() => setListOpen(false)}><div className="tab-list-heading dropdown-heading">所有标签页 <span>{normalTabs.length}</span></div>{normalTabs.map((id, index) => <button key={id} className={selectedTab === id ? "selected" : ""} onClick={() => { setSelectedTab(id); setListOpen(false); }}><span className="dropdown-item-content"><TabFavicon id={id} className="tab-list-icon"/><span>{titleFor(id)}</span></span><span className="tab-list-number">{index + 1}</span><span className="dropdown-item-trailing">{selectedTab === id && <Check size={16}/>}</span></button>)}</DropdownPanel></>}
    {dragPreview && <div className={`tab-drag-preview ${draggedTab && isTabGroup(draggedTab) ? "group-drag-preview" : ""}`} style={dragPreview} aria-hidden="true">{draggedTab && isTabGroup(draggedTab) ? <CollapsedBrandContent label={tabGroups[draggedTab].label} color={tabGroups[draggedTab].color}/> : <><TabFavicon id={draggedTab ?? ""}/><span>{titleFor(draggedTab ?? "")}</span></>}</div>}
  </>;
}
