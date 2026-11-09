import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, ListFilter, Plus, Search } from '../icons';
import { UserRound } from 'lucide-react';
import DropdownPanel from '../../DropdownPanel';
import OfficialSkills from './OfficialSkills';
import { SKILL_CATEGORIES, SKILL_TYPES, skillSections } from './workspace-skills';
import { getSkillCardIllustration } from './workspace-skill-icons';
import { getSkillScrollAnchor } from './workspace-skill-scroll';
import './workspace-skills.css';

function authorAvatar(name) {
  const seed = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const colors = ['#c5d5ea', '#e8cbb8', '#c9d9c3', '#d8c8e8', '#edd7aa'];
  const clothes = ['#42648b', '#a46d57', '#53785b', '#7b5c96', '#9e813c'];
  const index = seed % colors.length;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${colors[index]}"/><path d="M5 48c0-14 8-19 19-19s19 5 19 19" fill="${clothes[index]}"/><ellipse cx="24" cy="21" rx="10" ry="12" fill="#efc6a5"/><path d="M14 22V16c0-13 21-14 21 0v7l-4-9c-5 5-12 4-17 8" fill="${seed % 2 ? '#4b3530' : '#282d35'}"/><circle cx="20" cy="22" r="1" fill="#42352f"/><circle cx="28" cy="22" r="1" fill="#42352f"/><path d="M21 28q3 2 6 0" fill="none" stroke="#b77c67" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function WorkspaceSkills({ active = true, items, ui, setUI, onCreate, onOpen, onUpdate }) {
  const scope = ui.skillScope || 'discover';
  const [searchOpen,setSearchOpen] = useState(false);
  const [filterOpen,setFilterOpen] = useState(false);
  const [anchor,setAnchor] = useState('all');
  const [expanded,setExpanded] = useState({});
  const [columns,setColumns] = useState({});
  const [scrolled,setScrolled] = useState(false);
  const [edges,setEdges] = useState({left:false,right:false});
  const headerRef=useRef(null), panelRef=useRef(null), tabsRef=useRef(null), searchWrapRef=useRef(null), searchRef=useRef(null), searchButton=useRef(null), filterRef=useRef(null), filterButton=useRef(null);
  const sections=useMemo(() => skillSections(items,{scope,kind:ui.kind,query:ui.query}),[items,scope,ui.kind,ui.query]);
  const categories=scope==='mine' ? [['installed','已安装'],['custom','我创建的']] : [['all','全部'],['official','官方预装'],['hot','最热'],['latest','最新'],...SKILL_CATEGORIES];
  useLayoutEffect(() => {
    if (!active) return;
    const grids = [...panelRef.current.querySelectorAll('.aiws-cards')];
    function measure() {
      const next = Object.fromEntries(grids.map(grid => [grid.closest('[data-skill-section]').dataset.skillSection,
        Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length)]));
      setColumns(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
    const observer = new ResizeObserver(measure);
    grids.forEach(grid => observer.observe(grid));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [active, sections]);
  function measureEdges() { const node=tabsRef.current; if(node) setEdges({left:node.scrollLeft>1,right:node.scrollWidth-node.clientWidth-node.scrollLeft>1}); }
  useEffect(() => {
    if (!active) return;
    const header=headerRef.current, panel=panelRef.current;
    const host=panel;
    if (!host || !panel) return;
    const nodes=[...panel.querySelectorAll('[data-skill-section]')];
    let frame=0, needsMeasure=true, metrics;
    function update() {
      frame=0;
      if (document.hidden) return;
      if (needsMeasure) {
        const hostTop=host.getBoundingClientRect().top;
        const headerHeight=header.getBoundingClientRect().height;
        metrics={
          sections:nodes.map(node=>({id:node.dataset.skillSection,top:node.getBoundingClientRect().top-hostTop+host.scrollTop})),
          headerOffset:12,
          maxScroll:Math.max(0,host.scrollHeight-host.clientHeight),
          fallback:scope==='mine'?'installed':'all',
        };
        header.closest('.aiw-content')?.style.setProperty('--aiw-page-header-height',`${headerHeight}px`);
        measureEdges();
        revealCategory(tabsRef.current?.querySelector('[aria-current="location"]'));
        needsMeasure=false;
      }
      setScrolled(host.scrollTop>1);
      setAnchor(getSkillScrollAnchor({...metrics,scrollTop:host.scrollTop}));
    }
    function schedule() { if (!frame && !document.hidden) frame=requestAnimationFrame(update); }
    function refresh() { needsMeasure=true; schedule(); }
    const observer=new ResizeObserver(refresh);
    [host,header,panel,...nodes].forEach(node=>observer.observe(node));
    host.addEventListener('scroll',schedule,{passive:true});
    document.addEventListener('visibilitychange',refresh);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('scroll',schedule);
      document.removeEventListener('visibilitychange',refresh);
    };
  },[active,scope,sections]);
  useEffect(() => {
    if (active) revealCategory(tabsRef.current?.querySelector(`[data-skill-category="${anchor}"]`));
  },[anchor,active]);
  useEffect(() => {
    setAnchor(scope==='mine'?'installed':'all');
    panelRef.current?.scrollTo({top:0});
  },[scope,ui.kind,ui.query]);
  useEffect(() => {
    if(!searchOpen) return;
    function outside(event) { if(!searchWrapRef.current?.contains(event.target)) setSearchOpen(false); }
    function escape(event) { if(event.key==='Escape') { event.stopPropagation(); setSearchOpen(false); requestAnimationFrame(() => searchButton.current?.focus()); } }
    document.addEventListener('pointerdown',outside); document.addEventListener('keydown',escape,true);
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',escape,true); };
  },[searchOpen]);
  useEffect(() => {
    if(!filterOpen) return;
    function outside(event) { if(!filterRef.current?.contains(event.target)) setFilterOpen(false); }
    function escape(event) { if(event.key==='Escape') { event.stopPropagation(); setFilterOpen(false); filterButton.current?.focus(); } }
    document.addEventListener('pointerdown',outside); document.addEventListener('keydown',escape,true);
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',escape,true); };
  },[filterOpen]);
  function jump(value) {
    setAnchor(value);
    const host=panelRef.current;
    const target=document.getElementById(`aiws-section-${value}`);
    if(host && (value==='all' || target)) host.scrollTo({top:value==='all'?0:host.scrollTop + target.getBoundingClientRect().top - host.getBoundingClientRect().top - 12,behavior:'instant'});
  }
  function revealCategory(node) {
    const strip=tabsRef.current;
    if(!strip || !node) return;
    const bounds=strip.getBoundingClientRect();
    const tab=node.getBoundingClientRect();
    const max=strip.scrollWidth-strip.clientWidth;
    // Keep visible tabs still; leave room for the overlaid paging arrows.
    const left=bounds.left+(strip.scrollLeft>1?36:0);
    const right=bounds.right+(max-strip.scrollLeft>1?-36:0);
    const delta=tab.left<left?tab.left-left:tab.right>right?tab.right-right:0;
    const next=Math.max(0,Math.min(max,strip.scrollLeft+delta));
    if(Math.abs(next-strip.scrollLeft)>1) strip.scrollTo({
      left:next,
      behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',
    });
  }
  function switchScope(value) { setUI({skillScope:value}); setAnchor('all'); setExpanded({}); panelRef.current?.scrollTo({top:0}); }
  function arrowKeys(event) {
    const buttons=[...event.currentTarget.querySelectorAll('[role="tab"]')];
    const i=buttons.indexOf(document.activeElement); let next;
    if(event.key==='ArrowRight') next=(i+1)%buttons.length;
    if(event.key==='ArrowLeft') next=(i-1+buttons.length)%buttons.length;
    if(event.key==='Home') next=0;
    if(event.key==='End') next=buttons.length-1;
    if(next!==undefined) { event.preventDefault(); buttons[next].focus(); buttons[next].click(); }
  }
  function toggleSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  return <>
    <div className="aiwp-page-header aiws-header" data-scrolled={scrolled} ref={headerRef}>
      <header className="aiwp-heading"><div className="aiwp-heading-copy"><h1>妙招</h1><p className="aiwp-heading-description">发现好用的方法，管理常用的妙招。</p></div><div className="aiwp-heading-actions">
        <button className="aiwp-primary" onClick={onCreate}>创建妙招</button>
      </div></header>
      <div className="aiws-toolbar">
        <div className="aiws-segments" role="tablist" aria-label="妙招范围" onKeyDown={arrowKeys}>{[['discover','发现','zhinanzhen'],['mine','我的','ren']].map(([value,label,icon]) => <button key={value} role="tab" id={`aiws-scope-${value}`} aria-controls="aiws-panel" aria-selected={scope===value} tabIndex={scope===value?0:-1} onClick={() => switchScope(value)}><span className={`iconfont icon-${icon}`} aria-hidden="true"/><span className="aiws-tab-label">{label}</span></button>)}</div>
        <div className="aiwp-toolbar-actions">
        {searchOpen ? <div className="aiws-inline-search" role="search" ref={searchWrapRef}>
          <Search size={16} aria-hidden="true"/>
          <input ref={searchRef} aria-label="搜索妙招内容" placeholder="搜索名称、简介或作者…" value={ui.query} onChange={event=>setUI({query:event.target.value})}/>
        </div> : <button ref={searchButton} className="aiwp-icon-button aiws-search-button" aria-label="搜索妙招" aria-expanded={false} aria-pressed={Boolean(ui.query)} onClick={toggleSearch}><Search size={16}/></button>}
          <div className="aiws-filter" ref={filterRef}><button ref={filterButton} className="aiwp-icon-button" aria-label="筛选妙招类型" title="筛选妙招类型" aria-haspopup="true" aria-expanded={filterOpen} aria-pressed={ui.kind!=='all'} onClick={() => setFilterOpen(!filterOpen)}><ListFilter size={16}/></button>
            {filterOpen && <DropdownPanel className="aiws-filter-popover" label="类型筛选" onClose={() => {setFilterOpen(false);filterButton.current?.focus();}}><h2 className="dropdown-heading">类型</h2>{SKILL_TYPES.map(([value,label]) => <button key={value} aria-pressed={ui.kind===value} onClick={() => {setUI({kind:value});setFilterOpen(false);filterButton.current?.focus();}}><span>{label}</span><span className="dropdown-item-trailing" aria-hidden="true">{ui.kind===value && <Check size={16}/>}</span></button>)}</DropdownPanel>}
          </div>
        </div>
      </div>
      {<nav className="aiws-categories" data-left={edges.left} data-right={edges.right} aria-label="妙招分类锚点">
        <div className="aiws-category-scroll" ref={tabsRef} onScroll={measureEdges}>{categories.map(([value,label]) => <button key={value} data-skill-category={value} aria-current={anchor===value?'location':undefined} disabled={value!=='all' && !sections.some(section=>section.id===value)} onClick={event => {jump(value);revealCategory(event.currentTarget);}}><span className="aiws-tab-label">{label}</span></button>)}</div>
        {edges.left && <button className="aiwp-tab-arrow aiws-scroll-arrow is-left" aria-label="向左查看更多分类" onClick={()=>tabsRef.current?.scrollBy({left:-320,behavior:'smooth'})}><ChevronLeft size={16}/></button>}
        {edges.right && <button className="aiwp-tab-arrow aiws-scroll-arrow is-right" aria-label="向右查看更多分类" onClick={()=>tabsRef.current?.scrollBy({left:320,behavior:'smooth'})}><ChevronRight size={16}/></button>}
      </nav>}
    </div>
    <div id="aiws-panel" ref={panelRef} role="tabpanel" aria-labelledby={`aiws-scope-${scope}`} className="aiws-sections">
      {scope==='discover' && !ui.query && ui.kind==='all' && <div className="aiws-banner"><img src="/personalized-home-2-0/asset/skills-banner.png" alt="开学没招，Tabbit 给你妙招，看看大学生都在用什么招" width="2400" height="400"/></div>}
      {scope==='discover' && sections.every(section=>!section.items.length) ? <div className="aiws-empty"><Search size={24}/><h2>{'没有找到相关妙招'}</h2><p>{'试试其他关键词或类型。'}</p><button className="aiw-button" onClick={()=>setUI({query:'',kind:'all'})}>{'清除筛选'}</button></div> : sections.map(section => section.id==='official' ? <OfficialSkills key={section.id} section={section} onOpen={onOpen}/> : <section key={section.id} id={`aiws-section-${section.id}`} data-skill-section={section.id} className="aiws-section" aria-label={section.label}>
        {<div className="aiws-section-heading"><h2>{section.label}</h2>{section.items.length>2*(columns[section.id]||1) && <button aria-expanded={Boolean(expanded[section.id])} onClick={()=>setExpanded(previous=>({...previous,[section.id]:!previous[section.id]}))}>{expanded[section.id]?'收起':'展开'}<ArrowRight size={14}/></button>}</div>}
        {!section.items.length && <div className="aiws-module-empty"><p>{ui.query || ui.kind!=='all'?'没有符合筛选条件的妙招':section.id==='custom'?'还没有创建妙招':'还没有安装妙招'}</p><button className="aiw-button" onClick={()=>{if(ui.query || ui.kind!=='all')setUI({query:'',kind:'all'});else if(section.id==='custom')onCreate();else switchScope('discover');}}>{ui.query || ui.kind!=='all'?'清除筛选':section.id==='custom'?'创建妙招':'去发现'}</button></div>}
        <div className="aiws-cards">{(expanded[section.id]?section.items:section.items.slice(0,2*(columns[section.id]||1))).map(item=>{
          const { Icon, color, fill } = getSkillCardIllustration(item);
          const author = item.author === 'Tabbit 官方' ? '官方' : item.author;
          const typeLabel = SKILL_TYPES.find(([value])=>value===item.skillType)?.[1];
          const usage = item.usageCount>0 && <span className="aiws-usage" aria-label={`${item.usageCount.toLocaleString('zh-CN')} 次使用`} title={`${item.usageCount.toLocaleString('zh-CN')} 次使用（示例数据）`}><UserRound size={14} aria-hidden="true"/>{Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(item.usageCount)}</span>;
          return <article className="aiws-card" key={item.id} onClick={event => { if (!event.target.closest('button,a,input')) onOpen(item); }}>
            <div className="aiws-card-main"><button className="aiws-skill-icon" style={{'--aiws-icon-color':color,'--aiws-icon-fill':fill}} aria-label={`查看 ${item.title}详情`} onClick={()=>onOpen(item)}><Icon size={20} strokeWidth={1.7}/></button>
            <div className="aiws-card-copy"><div className="aiws-card-name"><button className="aiws-card-title" onClick={()=>onOpen(item)} title={item.title}>{item.title}</button></div><p title={item.description}>{item.description}</p></div>
            {item.type!=='custom' && <div className="aiws-card-actions"><button className="aiws-install" title={item.installed?'已安装，点击移除':'安装到我的妙招'} aria-label={`${item.installed?'移除已安装':'安装'} ${item.title}`} aria-pressed={item.installed} onClick={()=>onUpdate({...item,type:item.type==='installed'?'community':item.type,installed:!item.installed})}>{item.installed?<Check size={16}/>:<Plus size={16}/>}</button></div>}
            </div>
            <div className="aiws-card-meta"><img className="aiws-author-avatar" src={authorAvatar(author)} alt=""/><span className="aiws-author" title={author}>{author}</span><span className="aiws-type">{typeLabel}</span>{usage}</div>
          </article>;
        })}</div>
      </section>)}
    </div>
  </>;
}
