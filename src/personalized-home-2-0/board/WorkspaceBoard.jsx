import { NameDialog } from '../StandardDialog';
import './curated-desktop.css';
import { importedAICardSize, validateAICardPackage } from './ai-card-import';
import { BOARD_STORAGE } from './state';
import { createFrameBatch } from './frame-batch';
import BoardPagePreview from './BoardPagePreview';
import { useBoardPageMotion } from './useBoardPageMotion';
import { useVisibilityMotion } from '../useVisibilityMotion';
import { getHomeRoot } from "../home-host";
import { createPortal } from 'react-dom';
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, SquarePen, Scaling, ChevronRight, ListChecks, Trash2, CopyPlus, FileInput, PanelTop, Check, Undo2, Redo2 } from "../icons";
import WidgetCard, { widgetCatalog } from './WidgetCards';
import { widgetLibraryVariants, createLibraryWidgetItem } from './widget-library-variants';
import BoardItem from './BoardItem';
import { boardItemName as itemName } from './BoardItemContent';
import ContextSubmenu from '../ContextSubmenu';
import { BoardLibrary, BoardItemDialog, BoardConfirm } from './BoardDialogs';
import { movePackedBoardItem, resizeItem, resizePackedBoardItem, getBoardRows } from './layout';
import { boardAlignmentOffset, boardDragPosition, boardResizeMaxWidth } from './drag-geometry';
import { normalizeWidgetSize } from './widget-size';
import { normalizeSpectrumSize } from './spectrum/widget-size';
import { normalizeShortcutSize, SHORTCUT_SIZE_PRESETS } from './shortcut-size';
import useBatchEditJiggle from './useBatchEditJiggle';
import { addBoardItemToPage, boardColumns, updateBoardMeasurement, boardReadingOrder, gridProfile, layoutKey, projectPage, savePositions, patchBoardWidgetConfig } from './state';
import './workspace-board.css';
import '../context-menu.css';

const normalizeItemSize=(item,size,options)=>item.type==='shortcut'
  ? normalizeShortcutSize(size) : item.config?.visualStyle==='spectrum'
    ? normalizeSpectrumSize(item.kind,size,options) : normalizeWidgetSize(size,options);

const widgetDefaults = new Map(widgetCatalog.map(item => [item.kind, item.defaultSize || { w:2, h:2 }]));
const libraryVariants = widgetLibraryVariants(widgetCatalog);

function organizeBoardItems(items, columns) {
  const ordered=[...items].sort((a,b)=>a.y-b.y||a.x-b.x);
  const shortcuts=ordered.filter(item=>item.type==='shortcut');
  const arranged=[];
  let y=0,index=0;
  const shortcutRowCount=shortcuts.length?Math.max(1,Math.ceil(shortcuts.length/columns)):0;
  const shortcutBaseCount=shortcutRowCount?Math.floor(shortcuts.length/shortcutRowCount):0;
  const shortcutExtra=shortcutRowCount?shortcuts.length%shortcutRowCount:0;
  for(let rowIndex=0;rowIndex<shortcutRowCount;rowIndex++){
    const count=shortcutBaseCount+(rowIndex<shortcutExtra?1:0);
    const row=shortcuts.slice(index,index+count);index+=count;
    const baseWidth=Math.floor(columns/count);
    let remaining=columns-baseWidth*count,x=0;
    for(const item of row){
      const addition=remaining>0?1:0;remaining-=addition;
      const width=baseWidth+addition;
      arranged.push({...item,x,y,w:width,h:1});x+=width;
    }
    y++;
  }
  const widgets=ordered.filter(item=>item.type==='widget').map(item=>{
    const preferred=widgetDefaults.get(item.kind)||item.size||{w:2,h:2};
    return {...item,w:Math.min(columns,Math.max(2,preferred.w)),h:Math.max(2,Math.min(4,preferred.h))};
  });
  if(!widgets.length)return arranged;
  const idealPerRow=Math.max(1,Math.round(columns/4));
  const minPerFullRow=Math.max(1,Math.ceil(columns/6));
  const maxPerRow=Math.max(minPerFullRow,Math.floor(columns/3));
  let rowCount=Math.max(1,Math.round(widgets.length/idealPerRow));
  while(Math.ceil(widgets.length/rowCount)>maxPerRow)rowCount++;
  while(rowCount>1&&Math.floor(widgets.length/rowCount)<minPerFullRow)rowCount--;
  const baseCount=Math.floor(widgets.length/rowCount), extra=widgets.length%rowCount;
  index=0;
  for(let rowIndex=0;rowIndex<rowCount;rowIndex++){
    const count=baseCount+(rowIndex<extra?1:0);
    const row=widgets.slice(index,index+count);index+=count;
    const height=Math.max(...row.map(item=>item.h));
    const baseWidth=Math.floor(columns/count);
    let remaining=columns-baseWidth*count;
    for(const item of row){
      const addition=remaining>0?1:0;
      const width=baseWidth+addition;
      remaining-=addition;
      item.w=width;
    }
    let x=0;
    for(const item of row){arranged.push({...item,x,y,h:height});x+=item.w;}
    y+=height;
  }
  return arranged;
}

export default function WorkspaceBoard({ref,page,pages,onPageChange,onInitializeLayoutOrder,onRenameGroup,onDeleteGroup,onTransfer,onPageContextMenu,onAddPage,showLabels,appearanceTheme,shortcutSize='medium',shortcutShape='circle',showEmptyHint=true,visible=true,active=true,onEditingChange,onGenerateWidget,editing=false,onEditModeChange,overlayBlocked=false,undo,redo,canUndo=false,canRedo=false}){
  const setEditing=value=>onEditModeChange?.(value);
  const [selected,setSelected]=useState(null);
  const [library,setLibrary]=useState(false);
  const [editor,setEditor]=useState(null);
  const [editorTargetId,setEditorTargetId]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [menu,setMenu]=useState(null);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [drag,setDrag]=useState(null);
  const suppressedClickRef=useRef(null), dragHandlersRef=useRef(null), holdTimerRef=useRef(null), dragPaintRef=useRef(null);
  const [measurement,setMeasurement]=useState({width:700,columns:9,ready:false});
  const gridRef=useRef(null), rootRef=useRef(null), dragRef=useRef(null), busyRef=useRef(onEditingChange), menuRef=useRef(null), menuTriggerRef=useRef(null);
  const boardPresent = useVisibilityMotion(rootRef, visible, -20, { fade: false });
  const pageMotion = useBoardPageMotion(gridRef, page.id, visible && active && !editing, pages);
  const {width,columns,sourceColumns}=measurement;
  const strategy='gap';
  const mode='free';
  const profile=gridProfile(strategy,showLabels,(width-50)/(columns-1));
  const columnWidth=profile.pitch;
  const key=layoutKey(strategy,showLabels,mode,columns);
  const placed=useMemo(()=>projectPage(page,columns,strategy,showLabels,mode,sourceColumns),[page,columns,strategy,showLabels,mode,sourceColumns]);
  useLayoutEffect(()=>{
    if(measurement.ready&&!Array.isArray(page.layoutOrder))onInitializeLayoutOrder?.(page.id,boardReadingOrder(placed),{
      key,positions:Object.fromEntries(placed.map(({id,x,y})=>[id,{x,y}])),
    });
  },[measurement.ready,page,placed,key,onInitializeLayoutOrder]);
  const activeDrag=drag?.pageId===page.id?drag:null;
  const display=activeDrag?.placed||placed;
  const alignmentOffset=activeDrag?.kind==='resize'?activeDrag.alignmentOffset:boardAlignmentOffset(display,width,columnWidth,profile.gap);
  const rows=Math.max(1,getBoardRows(display),activeDrag?.minRows||0);
  const [toolbarHost,setToolbarHost]=useState(null);
  useLayoutEffect(()=>{setToolbarHost(rootRef.current?.closest('.home')||null);},[]);
  useBatchEditJiggle(rootRef,editing&&visible,Boolean(overlayBlocked||library||editor||confirm||menu));
  busyRef.current=onEditingChange;
  useEffect(()=>{busyRef.current?.(visible&&Boolean(library||editor||confirm||menu||drag||editing));return()=>busyRef.current?.(false);},[visible,library,editor,confirm,menu,drag,editing]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    if(!editing||overlayBlocked||library||editor||confirm||menu)return;
    const home=rootRef.current?.closest('.home');
    if(!home)return;
    let press=null;
    const isBlank=target=>target instanceof Element&&target.matches('.home, .home-scroll, .home-content, .home-feed, .workspace-board, .board-grid');
    const clear=()=>{press=null;};
    const down=event=>{
      press=null;
      if(event.button!==0||event.isPrimary===false||dragRef.current||!isBlank(event.target))return;
      press={id:event.pointerId,x:event.clientX,y:event.clientY};
    };
    const move=event=>{
      if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>=6)clear();
    };
    const click=event=>{
      const start=press;
      clear();
      // Require a real blank-to-blank click, never the release of a drag or a scroll.
      if(!start||event.detail===0||event.button!==0||dragRef.current||!isBlank(event.target))return;
      if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>=6)return;
      setSelected(null);setMenu(null);onEditModeChange?.(false);
    };
    home.addEventListener('pointerdown',down,true);
    home.addEventListener('pointermove',move,true);
    home.addEventListener('pointercancel',clear,true);
    home.addEventListener('click',click,true);
    home.addEventListener('scroll',clear,true);
    window.addEventListener('blur',clear);
    return()=>{
      home.removeEventListener('pointerdown',down,true);
      home.removeEventListener('pointermove',move,true);
      home.removeEventListener('pointercancel',clear,true);
      home.removeEventListener('click',click,true);
      home.removeEventListener('scroll',clear,true);
      window.removeEventListener('blur',clear);
    };
  },[editing,overlayBlocked,library,editor,confirm,menu,onEditModeChange]);
  useLayoutEffect(()=>{
    const grid=gridRef.current;
    if(!grid)return;
    const observe=entries=>{
      // Read layout width, independent of gesture translation. Height-only changes
      // return the existing measurement object and do not project the board again.
      const width=entries?.[0]?.contentRect.width ?? grid.clientWidth;
      setMeasurement(previous=>updateBoardMeasurement(previous,width,showLabels,page.preferredColumns));
    };
    observe();
    const ro=new ResizeObserver(observe);
    ro.observe(grid);
    return()=>ro.disconnect();
  },[showLabels,page.preferredColumns]);
  useLayoutEffect(()=>{
    cancelDrag();setSelected(null);setMenu(null);setNotice('');setError('');
    setLibrary(false);setEditor(null);setEditorTargetId(null);setConfirm(null);
  },[page.id]);
  useLayoutEffect(()=>{
    if(visible)return;
    cancelDrag();setSelected(null);setLibrary(false);setEditor(null);
    setEditorTargetId(null);setConfirm(null);setMenu(null);
  },[visible]);
  useEffect(()=>{if(overlayBlocked||library||editor||confirm||menu)cancelDrag(true);},[overlayBlocked,library,editor,confirm,menu]);
  useEffect(()=>{if(!menu)return;const dismiss=e=>{if(!menuRef.current?.contains(e.target))setMenu(null);};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[menu]);
  useLayoutEffect(()=>{
    if(!menu)return;
    const node=menuRef.current;
    if(!node)return;
    const reposition=()=>{
      const bounds=node.getBoundingClientRect();
      node.style.left=`${Math.max(8,Math.min(menu.x,window.innerWidth-bounds.width-8))}px`;
      node.style.top=`${Math.max(8,Math.min(menu.y,window.innerHeight-bounds.height-8))}px`;
    };
    reposition();
    if(menu.keyboard)node.querySelector(':scope > button:not(:disabled)')?.focus({preventScroll:true});
    window.addEventListener('resize',reposition);
    return()=>window.removeEventListener('resize',reposition);
  },[Boolean(menu),menu?.id,menu?.x,menu?.y,menu?.keyboard]);
  useEffect(()=>{
    const onKey=e=>{
      if(!visible||!active||overlayBlocked)return;
      if(e.key==='Escape'&&!(library||editor||confirm)&&(dragRef.current||menu||selected||editing)){
        if(dragRef.current){cancelDrag();setNotice('已取消移动');}
        else if(menu){setMenu(null);restoreMenuFocus();}else {setSelected(null);setEditing(false);}
        e.preventDefault();e.stopPropagation();
      }
      if(editing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){
        e.preventDefault();cancelDrag();e.shiftKey?redo():undo();
      }
    };document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
  },[visible,active,overlayBlocked,editing,menu,selected,library,editor,confirm,undo,redo]);
  useEffect(()=>{cancelDrag();},[width,columns,strategy,mode]);
  useEffect(()=>{
    const move=e=>dragHandlersRef.current?.move(e);
    const finish=e=>dragHandlersRef.current?.finish(e);
    const cancel=e=>{if(dragRef.current?.pointerId===e.pointerId)dragHandlersRef.current?.cancel(true);};
    const scroll=e=>{if(e.target===dragRef.current?.scrolling){if(dragRef.current.moved)dragHandlersRef.current?.refresh();else dragHandlersRef.current?.cancel(true);}};
    const blur=()=>dragHandlersRef.current?.cancel(true);
    const hidden=()=>{if(document.hidden)blur();};
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',finish);
    document.addEventListener('pointercancel',cancel);
    document.addEventListener('scroll',scroll,true);
    window.addEventListener('blur',blur);
    document.addEventListener('visibilitychange',hidden);
    return()=>{dragPaintRef.current?.cancel();clearTimeout(holdTimerRef.current);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',cancel);document.removeEventListener('scroll',scroll,true);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);const current=dragRef.current;if(current?.captureTarget?.hasPointerCapture(current.pointerId))current.captureTarget.releasePointerCapture(current.pointerId);dragRef.current=null;};
  },[]);
  const persist=(items,positions,description)=>{
    let next={...page,items};
    next=savePositions(next,key,positions);
    onPageChange(next);setError('');if(description)setNotice(description);
  };
  const updateConfig=(id,patch)=>onPageChange(current=>patchBoardWidgetConfig(current,id,patch),page.id);
  const commitMove=(id,x,y)=>{const next=movePackedBoardItem(placed,id,x,y,columns);persist(page.items,next,'位置已更新');};
  const resize=(item,requested,axis)=>{
    const size=normalizeItemSize(item,requested,{maxWidth:columns,axis,fallback:item.size});
    if(size.w===item.size?.w&&size.h===item.size?.h)return;
    const next=resizePackedBoardItem(placed,item.id,Math.min(size.w,columns),size.h*profile.widgetFactor,columns);
    persist(page.items.map(i=>i.id===item.id?{...i,size}:i),next,`已调整为 ${size.w} × ${size.h}`);
  };
  const addItem=(item,targetId=page.id)=>{
    const target=pages.find(entry=>entry.id===targetId);
    const result=addBoardItemToPage(target,item,{columns,showLabels,sourceColumns:targetId===page.id?sourceColumns:undefined});
    if(!result.ok){setError(result.message);return result;}
    onPageChange(result.page);setError('');setNotice(`已将${itemName(item)}添加到${target.name}`);
    if(targetId===page.id)setSelected(item.id);
    return {ok:true};
  };
  const addWidget=(kind,size,targetId=page.id,visualStyle='classic')=>{
    const def=widgetCatalog.find(i=>i.kind===kind);
    if(!def)return {ok:false,message:'该小组件暂不可用'};
    return addItem(createLibraryWidgetItem(def,{id:crypto.randomUUID(),size,visualStyle}),targetId);
  };
  const importAICard=(pkg,targetId=page.id)=>{
    try {
      validateAICardPackage(pkg);
      const target=pages.find(entry=>entry.id===targetId);
      const item={id:crypto.randomUUID(),type:'widget',kind:'ai-card',title:pkg.catalog.title,config:{aiCardPackage:pkg,aiCardStorage:{}},size:importedAICardSize(pkg)};
      const result=addBoardItemToPage(target,item,{columns,showLabels,sourceColumns:targetId===page.id?sourceColumns:undefined});
      if(!result.ok)return result;
      // Confirm persistence before reporting a successful import. Existing board
      // metadata and other pages remain intact when a large JSON hits quota.
      const saved=JSON.parse(localStorage.getItem(BOARD_STORAGE)||'{}');
      localStorage.setItem(BOARD_STORAGE,JSON.stringify({...saved,pages:pages.map(entry=>entry.id===targetId?result.page:entry)}));
      onPageChange(result.page);setError('');setNotice(`已将${pkg.catalog.title}添加到${target.name}`);
      if(targetId===page.id)setSelected(item.id);
      return {ok:true};
    }catch(reason){return {ok:false,message:reason?.name==='QuotaExceededError'?'本地存储空间不足，请精简卡片文件或移除不需要的内容。':reason.message||'导入失败，请重试。'};}
  };
  const saveItem=value=>{
    if(editor==='new'){
      const result=addItem({...value,id:crypto.randomUUID(),type:'shortcut',key:'custom',service:value.label},editorTargetId||page.id);
      if(!result.ok)return result;
    }
    else {onPageChange({...page,items:page.items.map(i=>i.id===editor.id?{...i,...value,service:value.label||i.service}:i)});setNotice('修改已保存');}
    setEditor(null);setEditorTargetId(null);restoreMenuFocus();return {ok:true};
  };
  const organizeLayout=(widthMode='standard')=>{
    if(!page.items.length){setNotice('当前看板还没有可整理的内容');return;}
    cancelDrag();setSelected(null);setMenu(null);setEditing(false);
    // The settings sidebar can temporarily narrow the live board. Build against
    // the requested closed-panel canvas so wide mode receives its full grid.
    const viewport=Math.max(320,rootRef.current?.ownerDocument?.defaultView?.innerWidth||width);
    const targetWidth=Math.min(widthMode==='wide'?1100:760,viewport-48);
    const targetColumns=boardColumns(targetWidth,showLabels,page.preferredColumns);
    const source=targetColumns===columns?display:projectPage(page,targetColumns,strategy,showLabels,mode,columns);
    const arranged=organizeBoardItems(source,targetColumns);
    const geometry=new Map(arranged.map(item=>[item.id,item]));
    const items=page.items.map(item=>{
      const tile=geometry.get(item.id);
      return tile?{...item,size:{w:tile.w,h:tile.h}}:item;
    });
    const targetKey=layoutKey(strategy,showLabels,mode,targetColumns);
    const next=savePositions({...page,items,layouts:{}},targetKey,arranged,{compact:false});
    onPageChange(next);setNotice('已按内容自动整理，可以撤销');
  };
  const remove=item=>{
    const rest=placed.filter(i=>i.id!==item.id);
    persist(page.items.filter(i=>i.id!==item.id),rest,`已移除${itemName(item)}，可以撤销`);
    setSelected(null);setMenu(null);
  };
  const removeFromTile=item=>{
    const index=placed.findIndex(entry=>entry.id===item.id);
    const next=placed[index+1]||placed[index-1];
    remove(item);
    requestAnimationFrame(()=>{const target=next?rootRef.current?.querySelector(`[data-board-item="${next.id}"]${next.type==='widget'?'':' .shortcut'}`):null;(target||gridRef.current)?.focus({preventScroll:true});});
  };
  const duplicate=item=>{addItem({...item,id:crypto.randomUUID(),config:{...item.config}});setMenu(null);restoreMenuFocus();};
  const startEditing=item=>{
    setEditing(true);setSelected(item?.id||null);setMenu(null);
    setNotice('已进入批量编辑。可拖动、调整大小或移除内容，点击空白或按 Escape 完成。');
  };
  const finishEditing=()=>{cancelDrag();setEditing(false);setSelected(null);setMenu(null);};
  const transfer=(item,targetId)=>{
    const result=onTransfer(item.id,targetId,{strategy,showLabels,mode,columns,sourceColumns});
    if(result?.ok){setSelected(null);setMenu(null);setError('');setNotice(result.message);restoreMenuFocus();}
    else setError(result?.message||'移动未完成，请重试');
  };
  const startDrag=(event,item,kind,direct=false)=>{
    if(event.button!==0||event.isPrimary===false||overlayBlocked||library||editor||confirm)return;
    if(direct&&event.target.closest('.board-remove-button,.board-resize-handle,input,textarea,select,[contenteditable="true"]'))return;
    clearTimeout(holdTimerRef.current);
    suppressedClickRef.current=null;
    if(!direct){event.preventDefault();event.stopPropagation();setSelected(item.id);setMenu(null);}
    const scrolling=gridRef.current.closest('.home-scroll');
    const card=event.currentTarget.closest('[data-board-item]');
    const bounds=card.getBoundingClientRect();
    // Jiggle rotates about the card center; remove its expanded bounding box
    // from the grab offset so a moving card remains under the same pointer point.
    const cardRect={left:bounds.x+bounds.width/2-card.offsetWidth/2,top:bounds.y+bounds.height/2-card.offsetHeight/2};
    const state={id:item.id,kind,direct,pageId:page.id,startX:event.clientX,startY:event.clientY,grabX:event.clientX-cardRect.left,grabY:event.clientY-cardRect.top,clientX:event.clientX,clientY:event.clientY,alignmentOffset,original:item,originalPlaced:placed,placed,minRows:rows,scrollTop:scrolling?.scrollTop||0,scrolling,pointerId:event.pointerId,captureTarget:event.currentTarget,size:item.size,moved:false,dx:0,dy:0};
    dragRef.current=state;
    if(!direct){setDrag(state);event.currentTarget.setPointerCapture(event.pointerId);}
    else if(!editing||event.pointerType==='touch'){
      holdTimerRef.current=setTimeout(()=>{
        if(dragRef.current!==state||state.moved||!state.captureTarget.isConnected)return;
        state.held=true;
        suppressedClickRef.current={id:state.id,pointerId:state.pointerId,until:Infinity};
        state.captureTarget.setPointerCapture(state.pointerId);
        if(event.pointerType==='touch'){
          cancelDrag();
          openMenu({preventDefault(){},stopPropagation(){},currentTarget:state.captureTarget,clientX:state.startX,clientY:state.startY},item);
        }else startEditing(item);
      },450);
    }
  };
  const pointerMove=(event,autoScroll=true)=>{
    const current=dragRef.current;if(!current||event.pointerId!==current.pointerId)return;
    const scrolling=current.scrolling;
    let dx=event.clientX-current.startX,dy=event.clientY-current.startY+(scrolling?.scrollTop||0)-current.scrollTop;
    if(Math.hypot(dx,dy)<6&&!current.moved)return;
    clearTimeout(holdTimerRef.current);
    if(event.cancelable)event.preventDefault();
    if(!current.moved){
      current.captureTarget.setPointerCapture(current.pointerId);
      setSelected(current.id);setMenu(null);
    }
    if(autoScroll&&scrolling){const rect=scrolling.getBoundingClientRect();if(event.clientY>rect.bottom-55)scrolling.scrollTop+=12;else if(event.clientY<rect.top+55)scrolling.scrollTop-=12;}
    dy=event.clientY-current.startY+(scrolling?.scrollTop||0)-current.scrollTop;
    let next,size=current.size,previewCell=current.previewCell;
    if(current.kind==='move'){
      const gridRect=gridRef.current.getBoundingClientRect();
      const point=boardDragPosition({clientX:event.clientX,clientY:event.clientY,gridLeft:gridRect.left+current.alignmentOffset,gridTop:gridRect.top,grabX:current.grabX,grabY:current.grabY,pitchX:columnWidth,pitchY:profile.pitch,columns,width:current.original.w});
      dx=point.left-current.original.x*columnWidth;
      dy=point.top-current.original.y*profile.pitch;
      // Preview the same dense layout that will be saved, including backfill.
      // The floating body retains its grip; the dashed outline shows its actual
      // landing cell. Always solve from the starting layout to avoid drift.
      previewCell={column:point.column,row:point.row};
      const sameCell=current.previewCell?.column===point.column&&current.previewCell?.row===point.row;
      next=sameCell?current.placed:movePackedBoardItem(current.originalPlaced,current.id,point.column,point.row,columns);
    }
    else{
      const maxWidth=boardResizeMaxWidth({boardWidth:width,pitch:columnWidth,gap:profile.gap,columns,column:current.original.x,offset:current.alignmentOffset});
      size=normalizeItemSize(current.original,{w:current.original.w+dx/columnWidth,h:current.original.h+dy/profile.pitch},{maxWidth,fallback:current.size});
      // Keep the top-left anchor stable while resizing; compact only on release.
      next=resizeItem(current.originalPlaced,current.id,size.w,size.h,columns,'free');
    }
    const minRows=Math.max(current.minRows,getBoardRows(next));
    const updated={...current,placed:next,size,previewCell,moved:true,dx,dy,minRows,clientX:event.clientX,clientY:event.clientY};dragRef.current=updated;
    // Preserve per-event packing, thresholds and edge auto-scroll. Only the
    // React preview waits for paint, avoiding a full card-tree render per sample.
    dragPaintRef.current ||= createFrameBatch(setDrag);
    dragPaintRef.current.schedule(updated);
  };
  const cancelDrag=(pointerEnded=false)=>{
    dragPaintRef.current?.cancel();
    clearTimeout(holdTimerRef.current);
    const current=dragRef.current;
    if(current?.captureTarget?.hasPointerCapture(current.pointerId))current.captureTarget.releasePointerCapture(current.pointerId);
    if(current?.moved||current?.held)suppressedClickRef.current={id:current.id,pointerId:current.pointerId,until:pointerEnded?performance.now()+500:Infinity};
    dragRef.current=null;setDrag(null);
  };
  const finishDrag=event=>{
    if(dragRef.current?.moved&&event.pointerId===dragRef.current.pointerId)pointerMove(event,false);
    const current=dragRef.current;
    if(!current){const click=suppressedClickRef.current;if(click?.pointerId===event.pointerId)click.until=performance.now()+500;return;}
    if(event.pointerId!==current.pointerId)return;
    if(current.moved){
      const changed=current.placed.some((item,index)=>{const before=current.originalPlaced[index];return item.x!==before.x||item.y!==before.y||item.w!==before.w||item.h!==before.h;});
      if(changed)persist(current.kind==='resize'?page.items.map(i=>i.id===current.id?{...i,size:current.size}:i):page.items,current.placed,current.kind==='resize'?'尺寸已吸附到栅格':'位置已更新');
    }
    cancelDrag(true);
  };
  dragHandlersRef.current={move:pointerMove,finish:finishDrag,cancel:cancelDrag,refresh:()=>{const current=dragRef.current;if(current?.moved)pointerMove({pointerId:current.pointerId,clientX:current.clientX,clientY:current.clientY,cancelable:false},false);}};
  const suppressDraggedClick=(event,item)=>{
    const click=suppressedClickRef.current;
    if(click?.id===item.id&&performance.now()<click.until){event.preventDefault();event.stopPropagation();suppressedClickRef.current=null;return;}
    if(editing&&!event.target.closest('.board-remove-button,.board-resize-handle')){
      event.preventDefault();event.stopPropagation();setSelected(item.id);
    }
  };
  const keyboardMove=(event,item)=>{
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-profile.shortcutH],ArrowDown:[0,profile.shortcutH]}[event.key];
    if(!delta)return;event.preventDefault();commitMove(item.id,item.x+delta[0],Math.max(0,item.y+delta[1]));
  };
  const restoreMenuFocus=()=>requestAnimationFrame(()=>{
    const trigger=menuTriggerRef.current;
    (trigger?.isConnected?trigger:gridRef.current)?.focus({preventScroll:true});
  });
  const openMenu=(event,item=null)=>{
    event.preventDefault();event.stopPropagation();setSelected(item?.id||null);
    const anchor=event.currentTarget?.getBoundingClientRect()||gridRef.current.getBoundingClientRect();
    const trigger=event.currentTarget instanceof HTMLElement?event.currentTarget:gridRef.current;
    menuTriggerRef.current=trigger.matches('a,button,[tabindex]')?trigger:trigger.querySelector('.shortcut')||trigger;
    const x=event.clientX||anchor.left, y=event.clientY||anchor.bottom;
    setMenu({id:item?.id||null,x,y,keyboard:event.type==='keydown'||(!event.clientX&&!event.clientY)});
  };
  const menuItem=page.items.find(i=>i.id===menu?.id);
  const changeMenuView=(view,keyboardSubmenu=false)=>setMenu(current=>!current||(current.view===view&&current.keyboardSubmenu===keyboardSubmenu)?current:{...current,view,keyboardSubmenu});
  const closeSubmenu=(restoreFocus=false)=>{
    const trigger=menuRef.current?.querySelector(`[data-setting-key="${menu.view}"]`);
    changeMenuView(null);
    if(restoreFocus)trigger?.focus({preventScroll:true});
  };
  const hoverMenuRow=event=>{
    if(event.pointerType==='touch')return;
    const row=event.target.closest('button');
    if(row?.parentElement===menuRef.current)changeMenuView(row.disabled?null:row.dataset.settingKey||null);
  };
  const openPageMenu=event=>{
    setMenu(null);
    if(onPageContextMenu)onPageContextMenu(event);
    else openMenu(event);
  };
  useImperativeHandle(ref,()=>({
    preparePageTransition: pageMotion.prepare,
    openLibrary:()=>setLibrary(true),
    dismissOverlays:()=>{cancelDrag();setLibrary(false);setEditor(null);setEditorTargetId(null);setConfirm(null);setMenu(null);},
    startEditing:()=>startEditing(),
    stopEditing:finishEditing,
    renameGroup:()=>setEditor({type:'group',title:page.name}),
    deleteGroup:()=>{if(pages.length>1)setConfirm('group');},
    organizeLayout,
  }));
  return <div ref={rootRef} hidden={!boardPresent} inert={!visible} aria-hidden={!visible || undefined} data-strategy={strategy} className={`workspace-board ${editing?'is-editing':''} ${showLabels?'':'labels-hidden'}`}>
    <div ref={pageMotion.outgoingRef} className="board-page-outgoing" aria-hidden="true" inert />
    <div ref={pageMotion.previewRef} className="board-page-preview" aria-hidden="true" inert>
      {pageMotion.previewPage && <BoardPagePreview page={pageMotion.previewPage} columns={columns} width={width} columnWidth={columnWidth} profile={profile} sourceColumns={sourceColumns} showLabels={showLabels} appearanceTheme={appearanceTheme} shortcutSize={shortcutSize} shortcutShape={shortcutShape} />}
    </div>
    <div ref={gridRef} className={`board-grid${activeDrag?.moved?' is-dragging':''}`} role="region" aria-label={`${page.name}快捷方式与小组件`} tabIndex={0} style={{height:rows*profile.pitch, '--board-column':`${columnWidth}px`,'--board-pitch':`${profile.pitch}px`,'--board-gap':`${profile.gap}px`,'--board-offset':`${alignmentOffset}px`}} onContextMenu={openPageMenu} onKeyDown={e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){const item=page.items.find(i=>i.id===e.target.closest('[data-board-item]')?.dataset.boardItem);const box=e.target.getBoundingClientRect();const event={preventDefault:()=>e.preventDefault(),stopPropagation:()=>e.stopPropagation(),target:e.target,currentTarget:e.target,clientX:box.x+8,clientY:box.bottom};if(item)openMenu(event,item);else openPageMenu(event);}}}>
      {activeDrag?.moved&&activeDrag.kind==='move'&&(()=>{const target=display.find(item=>item.id===activeDrag.id);return <div className={`board-drop-preview ${target.type==='shortcut'?'is-shortcut':'is-widget'} ${target.type==='shortcut'&&(target.w>1||target.h>1)?'is-expanded-shortcut':''}`} aria-hidden="true" style={{width:target.w*columnWidth-profile.gap,height:target.h*profile.pitch-profile.gap,transform:`translate(${alignmentOffset+target.x*columnWidth}px,${target.y*profile.pitch}px)`}}/>;})()}
      {display.map(item=>{
        const dragged=activeDrag?.id===item.id&&activeDrag.kind==='move'&&activeDrag.moved;
        const x=dragged?activeDrag.alignmentOffset+activeDrag.original.x*columnWidth+activeDrag.dx:alignmentOffset+item.x*columnWidth;
        const y=dragged?activeDrag.original.y*profile.pitch+activeDrag.dy:item.y*profile.pitch;
        return <BoardItem key={item.id} item={item}
          style={{width:item.w*columnWidth-profile.gap,height:item.h*profile.pitch-profile.gap,translate:`${x}px ${y}px`}}
          editing={editing} selected={selected===item.id} dragging={activeDrag?.id===item.id}
          resizing={activeDrag?.id===item.id&&activeDrag.kind==='resize'} showLabels={showLabels}
          appearanceTheme={appearanceTheme} shortcutSize={shortcutSize} shortcutShape={shortcutShape} active={active&&visible}
          onSelect={()=>setSelected(item.id)} onMoveKey={event=>keyboardMove(event,item)}
          onPointerDown={event=>startDrag(event,item,'move',true)} onClickCapture={event=>suppressDraggedClick(event,item)}
          onContextMenu={event=>{cancelDrag();openMenu(event,item);}} onChange={patch=>updateConfig(item.id,patch)}
          onRemove={()=>removeFromTile(item)} onResizeStart={event=>startDrag(event,item,'resize')}
          onResize={(size,axis)=>resize(item,size,axis)}/>;
      })}
      {showEmptyHint&&!page.items.length&&<div className="board-empty"><button type="button" onClick={()=>setLibrary(true)}><Plus size={16} aria-hidden="true"/>添加</button></div>}
    </div>
    {visible&&editing&&toolbarHost&&!overlayBlocked&&!library&&!editor&&!confirm&&createPortal(<div className="board-batch-toolbar" role="group" aria-label="批量编辑">
      <span>批量编辑</span>
      <button type="button" aria-label="撤销" title="撤销 ⌘Z" disabled={!canUndo} onClick={()=>{cancelDrag();undo();}}><Undo2 size={15}/></button>
      <button type="button" aria-label="重做" title="重做 ⇧⌘Z" disabled={!canRedo} onClick={()=>{cancelDrag();redo();}}><Redo2 size={15}/></button>
      <button type="button" className="board-batch-done" onClick={finishEditing}><Check size={14}/>完成</button>
    </div>,toolbarHost)}
    <span className="board-status" role="status">{notice}</span>
    {error&&<p className="board-error" role="alert">{error}</p>}
    {menu&&createPortal(<div ref={menuRef} className="board-context-menu home-context-menu" role="menu" aria-label={menuItem?menuItem.type==='widget'?'小组件菜单':'快捷方式菜单':'看板菜单'} onPointerOver={hoverMenuRow} onFocusCapture={e=>{if(e.target.parentElement===menuRef.current&&menu.view&&e.target.dataset.settingKey!==menu.view)closeSubmenu();}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();}} style={{left:menu.x,top:menu.y}} onKeyDown={e=>{if(e.key==='Escape'||(e.key==='ArrowLeft'&&Boolean(menu.view))){e.preventDefault();e.stopPropagation();if(menu.view)closeSubmenu(true);else{setMenu(null);restoreMenuFocus();}}else if(e.key==='Tab'){e.preventDefault();setMenu(null);restoreMenuFocus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const buttons=[...e.currentTarget.querySelectorAll(':scope > button:not(:disabled)')];const index=buttons.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length;buttons[next]?.focus();}}}>
      {menuItem?<>
        <button role="menuitem" onClick={()=>{setEditor(menuItem);setMenu(null);}}><SquarePen size={16} aria-hidden="true"/>编辑{menuItem.type==='widget'?'小组件':'快捷方式'}</button>
        {menuItem.type==='shortcut'&&<button type="button" role="menuitem" data-setting-key="itemSize" aria-haspopup="menu" aria-expanded={menu.view==='itemSize'} onClick={()=>changeMenuView('itemSize',true)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();changeMenuView('itemSize',true);}}}><Scaling size={16} aria-hidden="true"/><span>快捷方式大小</span><span className="home-menu-trailing" aria-hidden="true"><span>{SHORTCUT_SIZE_PRESETS.find(size=>size.w===normalizeShortcutSize(menuItem.size).w)?.label}</span><ChevronRight size={14}/></span></button>}
        <div role="separator"/>
        <button role="menuitem" onClick={()=>duplicate(menuItem)}><CopyPlus size={16} aria-hidden="true"/>复制</button>
        <button type="button" role="menuitem" data-setting-key="transfer" aria-haspopup="menu" aria-expanded={menu.view==='transfer'} disabled={pages.length<2} onClick={()=>changeMenuView('transfer',true)} onKeyDown={e=>{if(e.key==='ArrowRight'&&pages.length>1){e.preventDefault();e.stopPropagation();changeMenuView('transfer',true);}}}><FileInput size={16} aria-hidden="true"/><span>移动到看板</span><span className="home-menu-trailing" aria-hidden="true"><ChevronRight size={14}/></span></button>
        <div role="separator"/>
        <button role="menuitem" className="is-danger" onClick={()=>removeFromTile(menuItem)}><Trash2 size={16} aria-hidden="true"/>删除</button>
      </>:<>
        <button type="button" role="menuitem" data-setting-key="add" aria-haspopup="menu" aria-expanded={menu.view==='add'} onClick={()=>changeMenuView('add',true)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();changeMenuView('add',true);}}}><Plus size={16} aria-hidden="true"/><span>添加</span><span className="home-menu-trailing" aria-hidden="true"><ChevronRight size={14}/></span></button>
        <button role="menuitem" onClick={()=>startEditing()}><ListChecks size={16} aria-hidden="true"/>批量编辑</button>
      </>}
      {!menuItem&&menu.view==='add'&&<ContextSubmenu parentRef={menuRef} anchorKey="add" label="添加" focusOnOpen={menu.keyboardSubmenu} onBack={()=>closeSubmenu(true)} onDismiss={()=>{setMenu(null);restoreMenuFocus();}}>
        <button type="button" role="menuitem" disabled={!onAddPage||pages.length>=20} title={pages.length>=20?'最多可添加 20 个看板':undefined} onClick={()=>{setMenu(null);onAddPage?.();}}><span className="iconfont icon-jiahao" aria-hidden="true"/>添加看板</button>
        <button type="button" role="menuitem" onClick={()=>{setLibrary(true);setMenu(null);}}><span className="iconfont icon-jianchakongzhiban" aria-hidden="true"/>添加组件</button>
      </ContextSubmenu>}
      {menuItem&&menu.view&&<ContextSubmenu key={menu.view} parentRef={menuRef} anchorKey={menu.view} label={menu.view==='itemSize'?'快捷方式大小':'移动到看板'} focusOnOpen={menu.keyboardSubmenu} onBack={()=>closeSubmenu(true)} onDismiss={()=>{setMenu(null);restoreMenuFocus();}}>
        {menu.view==='itemSize'?SHORTCUT_SIZE_PRESETS.map(size=><button key={size.id} type="button" role="menuitemradio" aria-checked={normalizeShortcutSize(menuItem.size).w===size.w} onClick={()=>{resize(menuItem,size);setMenu(null);restoreMenuFocus();}}><span className="home-menu-check-slot" aria-hidden="true">{normalizeShortcutSize(menuItem.size).w===size.w&&<Check size={16}/>}</span>{size.label}（1×{size.w}）</button>):pages.filter(entry=>entry.id!==page.id).map(entry=><button type="button" role="menuitem" key={entry.id} onClick={()=>transfer(menuItem,entry.id)}><PanelTop size={16} aria-hidden="true"/>移动到{entry.name}</button>)}
      </ContextSubmenu>}
    </div>,getHomeRoot())}
    {library&&<BoardLibrary homeAnchorRef={rootRef} shortcutShape={shortcutShape} shortcutSize={shortcutSize} appearanceTheme={appearanceTheme} catalog={libraryVariants.map(def=>({...def,preview:<WidgetCard kind={def.kind} item={{config:{...def.defaultConfig,...(def.visualStyle==='spectrum'?{visualStyle:'spectrum'}:{})}}} appearanceTheme={appearanceTheme} preview/>}))} pages={pages} currentPageId={page.id} onAdd={addWidget} onShortcut={(value,targetId)=>addItem({...value,id:crypto.randomUUID(),type:'shortcut',key:'custom',service:value.label},targetId)} onGenerateWidget={onGenerateWidget} onImport={importAICard} onClose={()=>setLibrary(false)}/>}
    {editor&&editor.type!=='group'&&<BoardItemDialog item={editor==='new'?null:editor} appearanceTheme={appearanceTheme} onSave={saveItem} onClose={()=>{setEditor(null);setEditorTargetId(null);restoreMenuFocus();}}/>}
    {editor?.type==='group'&&<GroupNameDialog name={page.name} onClose={()=>setEditor(null)} onSave={name=>{onRenameGroup(name);setEditor(null);}}/>}
    {confirm&&<BoardConfirm title={`删除看板“${page.name}”？`} description={`将移除此看板中的 ${page.items.length} 个项目，之后可撤销。`} onConfirm={()=>{onDeleteGroup();setConfirm(null);}} onClose={()=>setConfirm(null)}/>}
  </div>;
}
function GroupNameDialog({name,onSave,onClose}) {
  const [value,setValue] = useState(name);
  const inputRef = useRef(null);
  return <NameDialog title="重命名看板" inputRef={inputRef} value={value} onChange={setValue} onClose={onClose} onSubmit={() => { if(value.trim()) onSave(value.trim()); }}/>;
}
