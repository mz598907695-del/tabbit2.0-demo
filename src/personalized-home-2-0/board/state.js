import { createCuratedSecondDesktop, refreshProvidedSecondPageIcons, CURATED_SECOND_DESKTOP_VERSION } from './curated-desktop.js';
/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { useEffect, useState } from 'react';
import { compactBoardItems, firstVacancy, layoutItems, reflowBoardItems } from './layout.js';
import { isWidgetSize, MAX_WIDGET_WIDTH } from './widget-size.js';
import { isShortcutSize, isLegacyShortcutSize, normalizeShortcutSize } from './shortcut-size.js';
import { daysUntil, safeIndex, DRAW_RESULTS, DAILY_QUOTES, DEMO_NEWS } from './widget-data.js';
import { COMMON_SCROLL_DEMO_VERSION, COMMON_SCROLL_DEMO_COUNT, makeCommonScrollDemoItems } from './scroll-demo-content.js';
import { sanitizeShortcutCustomIcon, shortcutHostname } from './shortcut-icon.js';
import { normalizeCodexUsageConfig, normalizeWorkdayConfig } from './utility-widget-data.js';

export const BOARD_STORAGE = 'personalized-home-2-0-board-v1';
export const MAX_BOARD_ITEMS = 300;
const MAX_BOARD_COLUMNS = MAX_WIDGET_WIDTH;
const LAYOUT_VERSION = 3;
const MAX_HISTORY = 30;
const widgetNames = {reminder:'提醒',joke:'笑话',image:'风景',weather:'天气',calendar:'日历',countdown:'倒计时',draw:'抽签',quote:'每日一句',news:'新闻','codex-usage':'Codex 用量监测','workday-countdown':'下班倒计时'};
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, fallback = '', max = 60) => typeof value === 'string' ? value.slice(0, max) : fallback;
const validUrl = (value) => { try { const url=new URL(value);return typeof value==='string'&&['http:', 'https:'].includes(url.protocol)&&Boolean(url.hostname); } catch { return false; } };
const validId = value => (typeof value==='string'&&value.length>0&&value.length<=160)||(typeof value==='number'&&Number.isFinite(value));
const position = value => record(value)&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.y>=0&&value.x<=63&&value.y<=10000 ? {x:Math.round(value.x),y:Math.round(value.y)} : null;
const parseLayoutKey = key => {
  const parsed=/^gap:(free|compact|sections):([1-9]\d?)$/.exec(key);
  return parsed&&Number(parsed[2])>=3&&Number(parsed[2])<=MAX_BOARD_COLUMNS?parsed:null;
};
const parseLegacyLayoutKey = key => /^(half|stable|compact):(labels|icons):(free|compact|sections):([3-9])$/.exec(key);

export const boardReadingOrder = items => [...items].sort((a,b)=>a.y-b.y||a.x-b.x).map(item=>item.id);
function cleanLayoutOrder(order, items) {
  if (!Array.isArray(order)) return null;
  const available = new Set(items.map(item=>String(item.id)));
  const seen = new Set();
  const retained = order.filter(id=>validId(id)).map(String).filter(id=>{
    if (!available.has(id)||seen.has(id)) return false;
    seen.add(id);return true;
  });
  return [...retained,...items.filter(item=>!seen.has(String(item.id))).map(item=>String(item.id))];
}

/** Migrate from the actual visible layout once, without creating an undo step. */
export function initializePageLayoutOrder(page, visibleOrder, measuredLayout) {
  if (Array.isArray(page.layoutOrder)) return page;
  const layoutOrder=cleanLayoutOrder(visibleOrder,page.items);
  if (!layoutOrder) return page;
  // Dense packing may put later narrow cards into earlier gaps. Recording only
  // their resulting visual order can repack that same measured view differently.
  // Seed its coordinates together with the order, without adding an undo step.
  const key=measuredLayout?.key;
  const parsed=parseLayoutKey(key);
  const source=measuredLayout?.positions;
  const positions=parsed?.[1]==='free'&&record(source)
    ? Object.fromEntries(page.items.flatMap(item=>{
      const point=Object.hasOwn(source,item.id)?position(source[item.id]):null;
      return point?[[item.id,point]]:[];
    })) : null;
  const layouts=positions&&Object.keys(positions).length===page.items.length
    ? {...page.layouts,[key]:positions} : page.layouts;
  return {...page,layoutOrder,layouts};
}

// Name visibility is presentation only. Legacy comparison layouts are converted
// once, using the previously active variant where available, then canonicalized.
function cleanLayouts(layouts, items, legacyOptions = {}) {
  if (!record(layouts)) return {};
  const result = {};
  // Filtering limits the result to the finite set of supported keys without
  // dropping legitimate wide-screen layouts after the old 147-key cutoff.
  const keys = Object.keys(layouts).filter(key=>parseLayoutKey(key)||parseLegacyLayoutKey(key));
  const clean = (source, divisor = 1) => Object.fromEntries(items.flatMap(item => {
    const point = Object.hasOwn(source, item.id) ? position(source[item.id]) : null;
    return point ? [[item.id, {x:point.x, y:Math.round(point.y / divisor)}]] : [];
  }));
  for (const key of keys) {
    if (parseLayoutKey(key) && record(layouts[key])) result[key] = clean(layouts[key]);
  }
  const preferredStrategy = ['half','stable','compact'].includes(legacyOptions.strategy) ? legacyOptions.strategy : 'half';
  const preferredState = legacyOptions.showLabels === false ? 'icons' : 'labels';
  const legacyKeys = keys.filter(key => parseLegacyLayoutKey(key) && record(layouts[key]));
  legacyKeys.sort((a,b) => {
    const rank = key => { const [,strategy,state] = parseLegacyLayoutKey(key); return (strategy===preferredStrategy?0:4)+(state===preferredState?0:1); };
    return rank(a)-rank(b);
  });
  for (const key of legacyKeys) {
    const [,strategy,,mode,count] = parseLegacyLayoutKey(key);
    const nextKey = layoutKey('gap', true, mode, Number(count));
    if (!Object.hasOwn(result,nextKey)) result[nextKey] = clean(layouts[key], strategy==='half'?3:1);
  }
  // The comparison controls are gone. Preserve the previously selected packing
  // mode as the starting arrangement of the single editable board.
  if (legacyKeys.length && ['compact','sections'].includes(legacyOptions.mode)) {
    for (let columns=3; columns<=9; columns++) {
      const freeKey=layoutKey('gap',true,'free',columns);
      const previousKey=layoutKey('gap',true,legacyOptions.mode,columns);
      if (!keys.includes(freeKey) && Object.hasOwn(result,previousKey)) result[freeKey]=result[previousKey];
    }
  }
  return result;
}

function versionFor(page) {
  if ([1,2,LAYOUT_VERSION].includes(page.layoutVersion)) return page.layoutVersion;
  // Old comparison pages had no per-page version; gap keys first appeared in v2.
  return Object.keys(page.layouts||{}).some(key=>parseLayoutKey(key)) ? 2 : 1;
}

function widgetSize(item, version) {
  const size = item.size;
  // Version 3 already uses the current square grid. Widths such as 3 and 6 are
  // now legitimate custom sizes and must never pass through legacy conversion.
  if (version >= 3) return isWidgetSize(size) ? size : sizePresets[0];
  // New widths are unambiguous, including newly added or resized items in a
  // legacy page that has not yet been persisted by the current application.
  const current = sizePresets.find(preset=>preset.w===size?.w&&preset.h===size?.h);
  if (current) return current;
  if (size?.w===3 || size?.w===6) {
    const w=size.w===6?4:2;
    const h=(version===1?size.h===3:size.h===4)?3:2;
    return sizePresets.find(preset=>preset.w===w&&preset.h===h);
  }
  return sizePresets[0];
}

const shortcutSize = item => normalizeShortcutSize(item.size);

function migratedItems(page) {
  const version = versionFor(page);
  return page.items.map(item => {
    if (item.type === 'shortcut') {
      if (item.size === undefined || isShortcutSize(item.size)) return item;
      return { ...item, size: shortcutSize(item) };
    }
    if (item.type !== 'widget' || version === LAYOUT_VERSION) return item;
    const size = widgetSize(item, version);
    return { ...item, size: { w: size.w, h: size.h } };
  });
}

function cleanConfig(kind, config) {
  const source=record(config)?config:{};
  if(kind==='reminder')return {text:typeof source.text==='string'?source.text.slice(0,2000):Array.isArray(source.lines)?source.lines.slice(0,20).map(line=>text(typeof line==='string'?line:line?.text,'',80)).join('\n').slice(0,2000):''};
  if(kind==='joke')return {text:text(source.text,'代码是程序员思维的镜子',2000)};
  if(kind==='image')return {caption:text(source.caption,'',200)};
  if(kind==='calendar')return {monthOffset:Number.isFinite(source.monthOffset)?Math.max(-1200,Math.min(1200,Math.trunc(source.monthOffset))):0};
  if(kind==='countdown')return {event:text(source.event,'新的开始',40),targetDate:daysUntil(source.targetDate)!==null?source.targetDate:`${new Date().getFullYear()+1}-01-01`};
  if(kind==='draw')return {index:safeIndex(source.index,DRAW_RESULTS.length)};
  if(kind==='quote')return {index:safeIndex(source.index,DAILY_QUOTES.length),text:text(source.text,'',500),author:text(source.author,'',60)};
  if(kind==='news')return {index:safeIndex(source.index,DEMO_NEWS.length)};
  if(kind==='codex-usage')return normalizeCodexUsageConfig(source);
  if(kind==='workday-countdown')return normalizeWorkdayConfig(source);
  const temperature=source.temperature??source.temp;
  return {city:text(source.city,'北京市',40),temperature:typeof temperature==='number'&&Number.isFinite(temperature)?String(temperature):text(temperature,'32',12),condition:text(source.condition,'多云',30)};
}
export function makeInitialPages(seeds, brands) {
  return seeds.map((page, p) => ({ id: `group-${p}`, name: page.name, layoutVersion:LAYOUT_VERSION, layouts: {}, items: page.items.map((entry, index) => {
    const [key, label] = entry;
    return { ...brands[key], id: `shortcut-${p}-${index}`, type: 'shortcut', key, label, w: 1, h: 1 };
  }) }));
}
export function makeSamplePage(seeds, brands) {
  const links=(makeInitialPages(seeds,brands)[0]?.items||[]).slice(0,12).map(i=>({...i,id:crypto.randomUUID()}));
  const widgets=[['reminder','提醒',{text:''}],['joke','笑话',{text:'代码是程序员思维的镜子'}],['image','风景',{caption:''}],['weather','天气',{city:'北京市',temperature:'32',condition:'多云'}]].map(([kind,title,config])=>({id:crypto.randomUUID(),type:'widget',kind,title,config,size:{w:2,h:2}}));
  const positions=Object.fromEntries([
    ...links.map((item,index)=>[item.id,{x:index%6,y:Math.floor(index/6)}]),
    ...widgets.map((item,index)=>[item.id,index===0?{x:6,y:0}:{x:(index-1)*3,y:3}]),
  ]);
  return {id:crypto.randomUUID(),name:'我的空间',layoutVersion:LAYOUT_VERSION,layouts:{'gap:free:9':positions},items:[...links,...widgets]};
}
export function sanitizePages(saved, fallback, legacyOptions = {}) {
  if (!Array.isArray(saved) || !saved.length || saved.length > 20) return fallback;
  const itemIds = new Set(), pageIds=new Set();
  const pages=saved.filter(record).map((page,p)=>{
    const desired=validId(page.id)?String(page.id):`group-${p}`;
    let id=desired,suffix=1;
    while(pageIds.has(id))id=`${desired}-${suffix++}`;
    pageIds.add(id);
    const version = versionFor(page);
    const items=(Array.isArray(page.items)?page.items:[]).slice(0,MAX_BOARD_ITEMS).flatMap(item=>{
      if(!record(item)||!validId(item.id))return [];
      const itemId=String(item.id),isWidget=item.type==='widget';
      if(itemIds.has(itemId)||(isWidget?!Object.hasOwn(widgetNames,item.kind):!validUrl(item.url)))return [];
      itemIds.add(itemId);
      if(isWidget){
        const preset=widgetSize(item,version);
        return [{id:itemId,type:'widget',kind:item.kind,title:text(item.title,widgetNames[item.kind],40),config:cleanConfig(item.kind,item.config),size:{w:preset.w,h:preset.h}}];
      }
      const label=text(item.label,text(item.service,'快捷方式',40),40);
      const size=shortcutSize(item);
      return [{id:itemId,type:'shortcut',key:text(item.key,'custom'),label,service:text(item.service,label),url:item.url,image:typeof item.image==='string'?item.image:undefined,darkImage:typeof item.darkImage==='string'?item.darkImage:undefined,customIcon:sanitizeShortcutCustomIcon(item.customIcon),iconHostname:typeof item.iconHostname==='string'?shortcutHostname(item.iconHostname):undefined,size:{w:size.w,h:size.h}}];
    });
    const layoutOrder=cleanLayoutOrder(page.layoutOrder,items);
    return {...(page.curatedLayoutVersion===CURATED_SECOND_DESKTOP_VERSION?{curatedLayoutVersion:page.curatedLayoutVersion}:{}),id,name:page.name==='混排体验'?'我的空间':text(page.name,'未命名',24)||'未命名',layoutVersion:LAYOUT_VERSION,items,layouts:cleanLayouts(page.layouts,items,legacyOptions),...(layoutOrder?{layoutOrder}:{})};
  });
  return pages.length?pages:fallback;
}

/** Append a one-time, public demo set without replacing any saved page content. */
export function supplementCommonPageForScroll(pages, appliedVersion = 0, today = new Date()) {
  if (appliedVersion >= COMMON_SCROLL_DEMO_VERSION) return pages;
  const page = pages.find(entry => entry.name === '常用');
  if (!page || page.items.length >= COMMON_SCROLL_DEMO_COUNT) return pages;
  const occupiedIds = new Set(pages.flatMap(entry => entry.items.map(item => item.id)));
  const additions = makeCommonScrollDemoItems(page.items, occupiedIds, Math.min(MAX_BOARD_ITEMS, COMMON_SCROLL_DEMO_COUNT) - page.items.length, today);
  if (!additions.length) return pages;
  const layouts = { ...page.layouts };
  const keys = new Set([...Object.keys(layouts).filter(key => parseLayoutKey(key)), layoutKey('gap', true, 'free', 9)]);
  for (const key of keys) {
    const [, mode, count] = parseLayoutKey(key);
    const columns = Number(count);
    const existing = projectPage(page, columns, 'gap', true, mode);
    const bottom = Math.max(0, ...existing.map(item => item.y + item.h));
    const appended = layoutItems(additions.map(item => ({ ...item, w: item.size ? Math.min(item.size.w, columns) : 1, h: item.size?.h ?? 1 })), columns, 'compact');
    layouts[key] = {
      ...(layouts[key] || Object.fromEntries(existing.map(item => [item.id, { x: item.x, y: item.y }]))),
      ...Object.fromEntries(appended.map(item => [item.id, { x: item.x, y: item.y + bottom }])),
    };
  }
  const updated = { ...page, items: [...page.items, ...additions], layouts };
  return pages.map(entry => entry === page ? updated : entry);
}

export function clampPageIndex(value, length) {
  const number=Number(value);
  return Math.min(Math.max(0,Math.trunc(Number.isFinite(number)?number:0)),Math.max(0,length-1));
}

/** Move a page to its final index without changing any page or item identity. */
export function reorderPages(pages, sourceId, targetIndex) {
  const sourceIndex=pages.findIndex(page=>page.id===sourceId);
  if(sourceIndex<0||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=pages.length||sourceIndex===targetIndex)return pages;
  const next=[...pages];
  const [page]=next.splice(sourceIndex,1);
  next.splice(targetIndex,0,page);
  return next;
}

const selectedPageIndex = history => Math.max(0,history.present.findIndex(page=>page.id===history.activeId));
const retainedPageId = (pages, activeId, index) => pages.some(page=>page.id===activeId)?activeId:pages[clampPageIndex(index,pages.length)]?.id??null;

export function createBoardHistory(pages, activeId = null, index = 0) {
  return {past:[],present:pages,future:[],activeId:retainedPageId(pages,activeId,index)};
}

// Selection shares the page-update queue but is not an undoable edit. This
// preserves the active page across reorders while keeping setPages + setIndex
// calls (append/delete, then select by index) compatible with React batching.
export function boardHistoryReducer(current, action) {
  const index=selectedPageIndex(current);
  if(action.type==='initialize-layout-order'){
    const page=current.present.find(page=>page.id===action.pageId);
    if(!page)return current;
    const next=initializePageLayoutOrder(page,action.order,action.measuredLayout);
    if(next===page)return current;
    // Unchanged page references can also live in another page's undo history.
    // Seed those identical snapshots, but never replace a real historical edit.
    const replace=pages=>pages.map(entry=>entry===page?next:entry);
    return {...current,present:replace(current.present),past:current.past.map(replace),future:current.future.map(replace)};
  }
  if(action.type==='index'){
    const nextIndex=clampPageIndex(typeof action.update==='function'?action.update(index):action.update,current.present.length);
    const activeId=current.present[nextIndex]?.id??null;
    return activeId===current.activeId?current:{...current,activeId};
  }
  if(action.type==='pages'){
    const next=typeof action.update==='function'?action.update(current.present):action.update;
    if(next===current.present)return current;
    return {...current,past:[...current.past,current.present].slice(-MAX_HISTORY),present:next,future:[],activeId:retainedPageId(next,current.activeId,index)};
  }
  if(action.type==='undo'&&current.past.length){
    const next=current.past.at(-1);
    return {...current,past:current.past.slice(0,-1),present:next,future:[current.present,...current.future],activeId:retainedPageId(next,current.activeId,index)};
  }
  if(action.type==='redo'&&current.future.length){
    const next=current.future[0];
    return {...current,past:[...current.past,current.present].slice(-MAX_HISTORY),present:next,future:current.future.slice(1),activeId:retainedPageId(next,current.activeId,index)};
  }
  return current;
}

export function useBoardState(seeds, brands) {
  const initial = () => {
    const fallback = makeInitialPages(seeds,brands);
    const read = key => {try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
    const options = read('personalized-home-2-0-board-options') || {};
    const preferences = read('personalized-home-2-0-preferences') || {};
    const saved = read(BOARD_STORAGE);
    const pages = sanitizePages(saved?.pages,fallback,{...options,showLabels:preferences.shortcutLabels!==false});
    // Apply the requested default desktop swap once, retaining all saved content.
    if (saved?.desktopOrderVersion !== 2 && pages[0]?.name === '常用' && pages[1]?.name === '工作') {
      [pages[0], pages[1]] = [pages[1], pages[0]];
    }
    if (saved?.firstDesktopShortcutsVersion !== 1 && pages[0]) {
      const items = fallback[0].items.map(item => ({ ...item, id: `first-desktop-entry-${item.key}` }));
      pages[0] = { ...pages[0], items, layouts: {}, layoutOrder: items.map(item => item.id) };
    }
    if (saved?.thirdDesktopEmptyVersion !== 1 && pages[2]) {
      pages[2] = { ...pages[2], items: [], layouts: {}, layoutOrder: [] };
    }
    if (saved?.curatedSecondDesktopVersion !== CURATED_SECOND_DESKTOP_VERSION && pages[1]) {
      pages[1] = createCuratedSecondDesktop(pages[1], brands);
    }
    if(pages[1])pages[1]=refreshProvidedSecondPageIcons(pages[1]);
    return pages;
  };
  const [history,setHistory] = useState(()=>{
    const pages=initial();
    try{return {...createBoardHistory(pages,localStorage.getItem('personalized-home-2-0-board-active-id'),localStorage.getItem('personalized-home-2-0-board-index')??0),commonScrollDemoVersion:COMMON_SCROLL_DEMO_VERSION,desktopOrderVersion:2,firstDesktopShortcutsVersion:1,thirdDesktopEmptyVersion:1,curatedSecondDesktopVersion:CURATED_SECOND_DESKTOP_VERSION};}
    catch{return {...createBoardHistory(pages),commonScrollDemoVersion:COMMON_SCROLL_DEMO_VERSION,desktopOrderVersion:2,firstDesktopShortcutsVersion:1,thirdDesktopEmptyVersion:1,curatedSecondDesktopVersion:CURATED_SECOND_DESKTOP_VERSION};}
  });
  const selectedIndex=selectedPageIndex(history);
  useEffect(()=>{try{
    localStorage.setItem('personalized-home-2-0-board-index',String(selectedIndex));
    if(history.activeId!==null)localStorage.setItem('personalized-home-2-0-board-active-id',history.activeId);
    else localStorage.removeItem('personalized-home-2-0-board-active-id');
  }catch{}},[selectedIndex,history.activeId]);
  // The marker belongs to the initialized history, not the module version:
  // Fast Refresh can retain a history that has not received the sample set yet.
  useEffect(()=>{try{localStorage.setItem(BOARD_STORAGE,JSON.stringify({version:LAYOUT_VERSION,desktopOrderVersion:history.desktopOrderVersion,firstDesktopShortcutsVersion:history.firstDesktopShortcutsVersion,thirdDesktopEmptyVersion:history.thirdDesktopEmptyVersion,curatedSecondDesktopVersion:history.curatedSecondDesktopVersion,commonScrollDemoVersion:history.commonScrollDemoVersion,pages:history.present.map(page=>({...page,layoutVersion:LAYOUT_VERSION}))}));}catch{}},[history.present,history.commonScrollDemoVersion,history.desktopOrderVersion,history.firstDesktopShortcutsVersion,history.thirdDesktopEmptyVersion,history.curatedSecondDesktopVersion]);
  const setPages=update=>setHistory(current=>boardHistoryReducer(current,{type:'pages',update}));
  const setIndex=update=>setHistory(current=>boardHistoryReducer(current,{type:'index',update}));
  const reorderPage=(id,index)=>setPages(pages=>reorderPages(pages,id,index));
  const initializeLayoutOrder=(pageId,order,measuredLayout)=>setHistory(current=>boardHistoryReducer(current,{type:'initialize-layout-order',pageId,order,measuredLayout}));
  const undo=()=>setHistory(current=>boardHistoryReducer(current,{type:'undo'}));
  const redo=()=>setHistory(current=>boardHistoryReducer(current,{type:'redo'}));
  return {pages:history.present,setPages,index:selectedIndex,setIndex,reorderPage,initializeLayoutOrder,undo,redo,canUndo:!!history.past.length,canRedo:!!history.future.length};
}
export const sizePresets = [
  {w:2,h:2,label:'标准'}, {w:2,h:3,label:'高卡'}, {w:4,h:2,label:'宽卡'}, {w:4,h:3,label:'大卡'},
];

/** Preserve compact breakpoints; wider boards fit 15 icons at 1100px with 25px gaps. */
export function boardColumns(width = 700, labels = true) {
  const measured=Number.isFinite(width)?Math.max(0,width):700;
  if (!labels) return Math.max(3, Math.min(MAX_BOARD_COLUMNS, Math.round((measured-50)/66)+1));
  return measured<=700
    ? Math.max(3,Math.min(9,Math.floor(measured/72)))
    : Math.min(MAX_BOARD_COLUMNS,Math.floor((measured-50)/75)+1);
}

/** Hidden boards report zero width; retain their last measured projection. */
export function updateBoardMeasurement(previous, width, labels = true) {
  if(!Number.isFinite(width)||width<=0)return previous;
  const columns=boardColumns(width,labels);
  if(previous.ready&&previous.width===width&&previous.columns===columns)return previous;
  return {width,columns,ready:true,sourceColumns:columns===previous.columns?previous.sourceColumns:previous.columns};
}

/** Both modes fill the board width; the column count controls their spacing. */
export function gridProfile(_strategy = 'gap', _labels = true, columnPitch = (700-50)/8) {
  const pitch = Number.isFinite(columnPitch) ? Math.max(50,columnPitch) : (700-50)/8;
  return {pitch,gap:pitch-50,shortcutH:1,widgetFactor:1};
}
// Keep the call signature stable for board actions, but deliberately ignore the
// label/strategy arguments: hiding names must never select a different layout.
export const layoutKey=(_strategy,_labels,mode='free',columns=9)=>`gap:${mode}:${columns}`;

function positionsFor(page, mode, columns) {
  const layouts=cleanLayouts(page.layouts,page.items);
  const saved=layouts[layoutKey('gap',true,mode,columns)];
  return record(saved)&&page.items.some(item=>Object.hasOwn(saved,item.id)&&position(saved[item.id]))?saved:null;
}

function applyPositions(items, saved) {
  return items.map(item=>({...item,...(saved&&Object.hasOwn(saved,item.id)?position(saved[item.id]):null)}));
}

function projectionSourceColumns(page,columns,mode,preferred) {
  if(Number.isInteger(preferred)&&preferred>=3&&preferred<=MAX_BOARD_COLUMNS&&preferred!==columns)return preferred;
  const layouts=cleanLayouts(page.layouts,page.items);
  return Object.keys(layouts)
    .map(key=>parseLayoutKey(key))
    .filter(parsed=>parsed&&parsed[1]===mode)
    .map(parsed=>Number(parsed[2]))
    .filter(count=>count!==columns&&page.items.some(item=>Object.hasOwn(layouts[layoutKey('gap',true,mode,count)],item.id)))
    .sort((a,b)=>Math.abs(a-columns)-Math.abs(b-columns)||(a===9?-1:b===9?1:b-a))[0];
}

export function projectPage(page,columns,_strategy='gap',_labels=true,mode='free',sourceColumns) {
  const version=versionFor(page);
  const baseItems=page.items.map(item=>{
    const size={...(item.type==='widget'?widgetSize(item,version):shortcutSize(item))};
    if(page.curatedLayoutVersion===CURATED_SECOND_DESKTOP_VERSION && columns===10 && item.type==='widget') {
      size.w=5;
      size.h=item.kind==='news'?4:['image','calendar','reminder'].includes(item.kind)?3:2;
    }
    return {...item,x:0,y:0,size:{w:size.w,h:size.h},w:Math.min(size.w,columns),h:size.h};
  });
  const saved=positionsFor(page,mode,columns);
  const order=mode==='free'?cleanLayoutOrder(page.layoutOrder,page.items):null;
  if(order){
    // Widths share one packing order. Preserve compatible saved geometry; otherwise
    // project that order and let later small items fill the gaps beside cards.
    if(saved){
      const positioned=page.curatedLayoutVersion===CURATED_SECOND_DESKTOP_VERSION?applyPositions(baseItems,saved):compactBoardItems(applyPositions(baseItems,saved),columns);
      if(page.curatedLayoutVersion===CURATED_SECOND_DESKTOP_VERSION || boardReadingOrder(positioned).every((id,index)=>String(id)===order[index]))return positioned;
    }
    const byId=new Map(baseItems.map(item=>[String(item.id),item]));
    const projected=reflowBoardItems(order.map(id=>byId.get(id)),columns);
    const positions=new Map(projected.map(item=>[item.id,item]));
    return baseItems.map(item=>positions.get(item.id));
  }
  if(saved){
    const positioned=applyPositions(baseItems,saved);
    return mode==='free'?compactBoardItems(positioned,columns):layoutItems(positioned,columns,'free');
  }
  // A new column count follows the current visual reading order, not the old
  // insertion order. Existing layouts still win and projection never saves one.
  if(mode==='free'){
    const source=projectionSourceColumns(page,columns,mode,sourceColumns);
    if(source!==undefined){
      const sourceItems=projectPage(page,source,_strategy,_labels,mode);
      const byId=new Map(baseItems.map(item=>[item.id,item]));
      const ordered=[...sourceItems].sort((a,b)=>a.y-b.y||a.x-b.x).map(item=>byId.get(item.id));
      const projected=layoutItems(ordered,columns,'compact');
      const positions=new Map(projected.map(item=>[item.id,item]));
      return baseItems.map(item=>positions.get(item.id));
    }
  }
  // Responsive projections are calculated without overwriting other layouts.
  return layoutItems(baseItems,columns,mode==='sections'?'sections':'compact');
}
export function savePositions(page,key,placed) {
  const parsed=parseLayoutKey(key);
  if(!parsed)return page;
  const [,mode,columnCount]=parsed;
  // Drag previews are already packed: this is idempotent for their geometry.
  // Other edits still compact here; cached widths share the latest reading order.
  const compacted=mode==='free'?compactBoardItems(placed,Number(columnCount)):placed;
  const positions=Object.fromEntries(compacted.map(item=>[item.id,{x:item.x,y:item.y}]));
  const items=migratedItems(page).map(item=>{
    const tile=page.curatedLayoutVersion&&placed.find(tile=>tile.id===item.id);
    return tile?{...item,size:{w:tile.w,h:tile.h}}:item;
  });
  return {...page,curatedLayoutVersion:undefined,layoutVersion:LAYOUT_VERSION,items,layouts:{...cleanLayouts(page.layouts,page.items),[key]:positions},...(mode==='free'?{layoutOrder:cleanLayoutOrder(boardReadingOrder(compacted),items)}:{})};
}

/** Add to the chosen page without selecting it or overwriting other widths. */
export function addBoardItemToPage(page, item, {columns=9,showLabels=true,sourceColumns} = {}) {
  const fail=message=>({ok:false,message});
  if(!record(page)||!validId(page.id)||!Array.isArray(page.items))return fail('页面已不存在，请重新选择');
  if(page.items.length>=MAX_BOARD_ITEMS)return fail(`“${page.name}”已有 ${MAX_BOARD_ITEMS} 个项目，请选择其他页面`);
  if(!record(item)||!validId(item.id))return fail('项目无效，请重新添加');
  const id=String(item.id);
  if(page.items.some(entry=>String(entry.id)===id))return fail('此页面中已存在这个项目');
  if(!['widget','shortcut'].includes(item.type))return fail('不支持此项目类型');
  const widget=item.type==='widget';
  if(widget&&(typeof item.kind!=='string'||!Object.hasOwn(widgetNames,item.kind)))return fail('不支持此小组件');
  const size=widget?(isWidgetSize(item.size)?item.size:null):shortcutSize(item);
  if(widget&&!size)return fail('小组件宽高需为整数栅格，最小为 1 × 2 或 2 × 1');
  if(!widget&&item.size!==undefined&&!isLegacyShortcutSize(item.size))return fail('请选择快捷方式的有效尺寸');
  if(!widget&&!validUrl(item.url))return fail('请输入有效的 HTTP 或 HTTPS 链接');

  const count=Number.isFinite(columns)?Math.max(3,Math.min(MAX_BOARD_COLUMNS,Math.floor(columns))):9;
  const added={...item,id,size:{w:size.w,h:size.h}};
  const placed=projectPage(page,count,'gap',showLabels,'free',sourceColumns);
  const shape={...added,w:Math.min(size.w,count),h:size.h};
  const point=firstVacancy(placed,shape.w,shape.h,count);
  // Migrate existing legacy cards before appending a new arbitrary size, so a
  // freshly added 3×3 card is not mistaken for a historical preset.
  const next=savePositions({...page,layoutVersion:LAYOUT_VERSION,items:[...migratedItems(page),added]},layoutKey('gap',showLabels,'free',count),[...placed,{...shape,...point}]);
  return {ok:true,page:next};
}

/** Validate first, then transfer both item data and the active layout atomically. */
export function transferBoardItem(pages, sourceId, targetId, itemId, context = {}) {
  const fail = message => ({ ok: false, message, pages });
  const source = pages.find(page => page.id === sourceId);
  const target = pages.find(page => page.id === targetId);
  if (!source || !target) return fail('页面已不存在，请重新选择');
  if (sourceId === targetId) return fail('项目已经在这个页面中');
  const item = source.items.find(entry => entry.id === itemId);
  if (!item) return fail('项目已不存在，请重新选择');
  if (target.items.length >= MAX_BOARD_ITEMS) return fail(`“${target.name}”已有 ${MAX_BOARD_ITEMS} 个项目，请选择其他页面`);
  if (target.items.some(entry => entry.id === itemId)) return fail('目标页面中已存在这个项目');

  const strategy = 'gap';
  const mode = ['free', 'compact', 'sections'].includes(context.mode) ? context.mode : 'free';
  const labels = context.showLabels !== false;
  const columns = Number.isFinite(context.columns) ? Math.max(3, Math.min(MAX_BOARD_COLUMNS, Math.floor(context.columns))) : 9;
  const key = layoutKey(strategy, labels, mode, columns);

  const sourceProjection = projectPage(source, columns, strategy, labels, mode, context.sourceColumns);
  const remaining = sourceProjection.filter(entry => entry.id !== itemId);
  const sourcePositions = mode === 'free' ? remaining : layoutItems(remaining, columns, mode);
  // Remove stale coordinates from every saved variant so returning to this
  // group later behaves like a new add, not a hidden restoration of old data.
  const withoutItemPosition = layouts => Object.fromEntries(Object.entries(layouts || {}).map(([savedKey, positions]) => [savedKey, Object.fromEntries(Object.entries(positions).filter(([id]) => id !== String(itemId)))]));
  const nextSource = savePositions({ ...source, items: source.items.filter(entry => entry.id !== itemId), layouts: withoutItemPosition(source.layouts) }, key, sourcePositions);

  const targetPositions = projectPage(target, columns, strategy, labels, mode);
  const migrated = sourceProjection.find(entry=>entry.id===itemId);
  const transferredItem = {...item,size:{...migrated.size}};
  const shape = {
    ...transferredItem,
    w: Math.min(transferredItem.size.w, columns),
    h: transferredItem.size.h,
  };
  const destination = firstVacancy(targetPositions, shape.w, shape.h, columns);
  const appended = [...targetPositions, { ...shape, ...destination }];
  const nextTarget = savePositions({ ...target, layoutVersion:LAYOUT_VERSION, items: [...migratedItems(target), transferredItem], layouts: withoutItemPosition(target.layouts) }, key, mode === 'free' ? appended : layoutItems(appended, columns, mode));
  return {
    ok: true,
    message: `已移动到“${target.name}”`,
    pages: pages.map(page => page.id === sourceId ? nextSource : page.id === targetId ? nextTarget : page),
  };
}
