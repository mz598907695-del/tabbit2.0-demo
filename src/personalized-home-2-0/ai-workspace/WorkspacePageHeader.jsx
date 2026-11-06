import React, { useEffect, useRef, useState } from 'react';
import { OutputSort, OutputGridView, OutputListView, OutputFolder, OutputGlobe, OutputDocument, Image, OutputTable, Paperclip, OutputCollection, OutputAppWindow, ArrowDownUp, Check, ChevronLeft, ChevronRight, Grid2X2, List, RefreshCw, Search, X } from '../icons';
import './workspace-page-header.css';
import '../../styles/dropdown.css';
import { AlarmClock, Start, Pause } from '../icons';

const OUTPUT_FILTER_ICONS = { all: OutputFolder, web: OutputGlobe, doc: OutputDocument, image: Image, table: OutputTable, other: Paperclip, card: OutputCollection, board: OutputAppWindow };
const TASK_FILTER_ICONS = { all:AlarmClock, active:Start, paused:Pause };
const SORT_OPTIONS = [['recent', '最近添加'], ['oldest', '最早添加'], ['name', '名称排序']];
const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

// Shared page anatomy: title with inline search, one-line categories and tools.
export default function WorkspacePageHeader({ page, title, action, onAction, tabs, ui, setUI, secondaryActions, searchable = true, hasViews = false, filters, counts, onRefresh }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false });
  const searchRef = useRef(null);
  const searchToggleRef = useRef(null);
  const headerRef = useRef(null);
  const tabsRef = useRef(null);
  const sortRef = useRef(null);
  const sortTrigger = useRef(null);
  const searchRoot = useRef(null);
  const unifiedSearch = ['files','tasks'].includes(page);
  const expanded = searchable && (searchOpen || (!unifiedSearch && !!ui.query));
  useEffect(() => {
    if(!unifiedSearch || !searchOpen) return;
    const outside = event => { if(!searchRoot.current?.contains(event.target)) setSearchOpen(false); };
    document.addEventListener('pointerdown',outside);
    return () => document.removeEventListener('pointerdown',outside);
  },[page,searchOpen]);
  const resultsId = page === 'files' ? 'aiwf-results' : `aiw-${page}-results`;
  const tabId = value => page === 'files' ? `aiwf-tab-${value}` : `aiw-${page}-tab-${value}`;
  function measureEdges() {
    const node = tabsRef.current;
    if (!node) return;
    const next = { left: node.scrollLeft > 1, right: node.scrollWidth - node.clientWidth - node.scrollLeft > 1 };
    setEdges(previous => previous.left === next.left && previous.right === next.right ? previous : next);
  }
  function revealTab(node, behavior = scrollBehavior()) {
    const rail = tabsRef.current;
    if (!rail || !node) return;
    const bounds = rail.getBoundingClientRect();
    const item = node.getBoundingClientRect();
    const left = bounds.left + (rail.scrollLeft > 1 ? 36 : 0);
    const right = bounds.right - (rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 1 ? 36 : 0);
    const delta = item.left < left ? item.left - left : item.right > right ? item.right - right : 0;
    if (delta) rail.scrollBy({ left: delta, behavior });
  }
  useEffect(() => {
    const header = headerRef.current;
    const content = header?.closest('.aiw-content');
    if (!content) return;
    const observer = new ResizeObserver(() => {
      const sections = [...header.children];
      const height = unifiedSearch && sections.length
        ? sections.at(-1).getBoundingClientRect().bottom - sections[0].getBoundingClientRect().top
        : header.getBoundingClientRect().height;
      content.style.setProperty('--aiw-page-header-height', `${height}px`);
      measureEdges();
      revealTab(tabsRef.current?.querySelector('[aria-selected="true"]'), 'auto');
    });
    if (unifiedSearch) [...header.children].forEach(section => observer.observe(section));
    else observer.observe(header);
    if (tabsRef.current) observer.observe(tabsRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { revealTab(tabsRef.current?.querySelector('[aria-selected="true"]')); }, [ui.filter]);
  useEffect(() => {
    if (!sortOpen) return;
    sortRef.current?.querySelector('[aria-checked="true"]')?.focus();
    const outside = event => { if (!sortRef.current?.contains(event.target)) setSortOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [sortOpen]);
  function closeSearch() {
    setSearchOpen(false); if(!unifiedSearch) setUI({ query: '' });
    requestAnimationFrame(() => searchToggleRef.current?.focus());
  }
  function moveTab(event, index) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault(); setUI({ filter: tabs[next][0] });
    tabsRef.current.children[next]?.focus({ preventScroll: true });
  }
  const searchControl = expanded ? <div ref={searchRoot} id={`aiwp-${page}-search`} className="aiwp-inline-search" role="search">
          <Search size={16} aria-hidden="true"/>
          <input ref={searchRef} aria-label={`搜索${title}内容`} placeholder="搜索名称或描述…" value={ui.query} onChange={event => setUI({ query: event.target.value })} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }}/>
          {!unifiedSearch && <button className="aiwp-search-clear" aria-label={ui.query ? '清空搜索' : '关闭搜索'} onClick={() => { if (ui.query) { setSearchOpen(true); setUI({ query: '' }); searchRef.current?.focus(); } else closeSearch(); }}><X size={12}/></button>}
        </div> : searchable && <button ref={searchToggleRef} className="aiwp-icon-button aiwp-search-toggle" aria-label={`搜索${title}`} title={`搜索${title}`} aria-expanded={false} aria-pressed={Boolean(ui.query)} aria-controls={`aiwp-${page}-search`} onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); }}><Search size={16}/></button>;
  return <div ref={headerRef} className={`aiwp-page-header has-inline-search ${expanded ? 'is-searching' : ''}`}>
    <header className="aiwp-heading">
      <div className="aiwp-heading-copy"><h1>{title}</h1>{page === 'files' && <p className="aiwp-heading-description">对话里的资料与生成的内容，都在这里。</p>}{page === 'tasks' && <p className="aiwp-heading-description">安排重复的事，管理每一次执行。</p>}</div>
      <div className="aiwp-heading-actions">
        {!['files','tasks'].includes(page) && searchControl}
        {secondaryActions}
        <button className="aiwp-primary" onClick={onAction}>{action}</button>
      </div>
    </header>
    <div className="aiwp-toolbar">
      <div className="aiwp-tab-rail" data-left={edges.left} data-right={edges.right}>
        <div className="aiwp-tabs" ref={tabsRef} role="tablist" aria-label={`${title}分类`} onScroll={measureEdges}>
          {tabs.map(([value, label], index) => <button key={value} role="tab" id={tabId(value)} aria-selected={ui.filter === value} tabIndex={ui.filter === value ? 0 : -1} aria-controls={resultsId} onClick={() => setUI({ filter: value })} onKeyDown={event => moveTab(event, index)}>{page === 'files' && OUTPUT_FILTER_ICONS[value] && React.createElement(OUTPUT_FILTER_ICONS[value], { size:16, "aria-hidden":true })}{page === 'tasks' && TASK_FILTER_ICONS[value] && React.createElement(TASK_FILTER_ICONS[value], { size:16, 'aria-hidden':true })}{label}{counts && <span className="aiwp-tab-count">{counts[value]}</span>}</button>)}
        </div>
        {edges.left && <button className="aiwp-tab-arrow is-left" aria-label="向左查看更多分类" onClick={() => tabsRef.current.scrollBy({ left: -Math.max(120, tabsRef.current.clientWidth * .7), behavior: scrollBehavior() })}><ChevronLeft size={16}/></button>}
        {edges.right && <button className="aiwp-tab-arrow is-right" aria-label="向右查看更多分类" onClick={() => tabsRef.current.scrollBy({ left: Math.max(120, tabsRef.current.clientWidth * .7), behavior: scrollBehavior() })}><ChevronRight size={16}/></button>}
      </div>
      {(searchable || filters || hasViews || onRefresh) && <div className="aiwp-toolbar-actions">
        {unifiedSearch && searchControl}
        {filters}
        {searchable && <div ref={sortRef} className="aiwp-sort-control" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSortOpen(false); }} onKeyDown={event => { if (event.key === 'Escape' && sortOpen) { event.stopPropagation(); setSortOpen(false); sortTrigger.current?.focus(); } }}>
          <button ref={sortTrigger} className="aiwp-icon-button" aria-label={`${title}排序方式`} title={`排序：${SORT_OPTIONS.find(([value]) => value === ui.sort)?.[1]}`} aria-haspopup="menu" aria-expanded={sortOpen} aria-pressed={ui.sort !== 'recent'} onClick={() => setSortOpen(value => !value)}>{['files','tasks'].includes(page) ? <OutputSort size={16}/> : <ArrowDownUp size={16}/>}</button>
          {sortOpen && <div className={`aiwp-sort-menu ${unifiedSearch ? 'dropdown-panel' : 'home-context-menu'}`} role="menu" aria-label={`${title}排序`} onKeyDown={event => {
            const buttons = [...event.currentTarget.querySelectorAll('button')];
            const index = buttons.indexOf(document.activeElement);
            const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : undefined;
            if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
          }}><h2 className={unifiedSearch ? 'dropdown-heading' : 'home-menu-heading'}>排序</h2>{SORT_OPTIONS.map(([value, label]) => <button key={value} role="menuitemradio" aria-checked={ui.sort === value} onClick={() => { setUI({ sort: value }); setSortOpen(false); sortTrigger.current?.focus(); }}><span>{label}</span><span className="home-menu-trailing">{ui.sort === value && <Check size={16}/>}</span></button>)}</div>}
        </div>}
        {['files','tasks'].includes(page) && hasViews && <div className="aiwp-toolbar-divider" role="separator" aria-orientation="vertical"/>}
        {hasViews && <div className="aiwp-views" role="group" aria-label={`${title}视图`}>
          <button className="aiwp-icon-button" aria-label="卡片视图" title="卡片视图" aria-pressed={ui.view === 'grid'} onClick={() => setUI({ view: 'grid' })}>{['files','tasks'].includes(page) ? <OutputGridView size={16}/> : <Grid2X2 size={16}/>}</button>
          <button className="aiwp-icon-button" aria-label="列表视图" title="列表视图" aria-pressed={ui.view === 'list'} onClick={() => setUI({ view: 'list' })}>{['files','tasks'].includes(page) ? <OutputListView size={16}/> : <List size={16}/>}</button>
        </div>}
        {onRefresh && page !== 'files' && <button className="aiwp-icon-button" aria-label={`刷新${title}`} title="刷新本地输出物" onClick={onRefresh}><RefreshCw size={16}/></button>}
      </div>}
    </div>
  </div>;
}
