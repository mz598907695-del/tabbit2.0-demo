import { useCallback, useEffect, useRef } from 'react';

let renderer;
const loadRenderer=()=>renderer ||= import('./effects/task-shockwave.js').catch(error=>{renderer=null;throw error;});

export function useTaskShockwave(ownerRef, mode) {
  const current=useRef({epoch:0,cancel:null,frame:0});
  const previousMode=useRef(mode);
  const cancel=useCallback(()=>{
    const state=current.current;
    state.epoch++;
    cancelAnimationFrame(state.frame); state.frame=0;
    state.cancel?.(); state.cancel=null;
  },[]);
  useEffect(()=>cancel,[cancel]);
  const start=useCallback(()=>{
    cancel();
    const state=current.current, epoch=state.epoch;
    const triggerTime=performance.now();
    // Pointer presses start before the click commits task mode. Hover only
    // loads this small module; it never takes a snapshot or starts a GPU loop.
    void (async()=>{
      let playTaskShockwave;
      try { ({playTaskShockwave}=await loadRenderer()); }
      catch { return; }
      if(state.epoch!==epoch) return;
      const owner=ownerRef.current;
      const region=owner?.closest('.glass-surface') || document.documentElement;
      const input=owner?.querySelector('.tb-composer')?.getBoundingClientRect();
      if(!region || !input) return;
      state.cancel=playTaskShockwave({region,owner,triggerTime,origin:{x:input.left+input.width/2,y:input.top+input.height/2}});
    })();
  },[cancel,ownerRef]);
  useEffect(()=>{
    if(previousMode.current===mode) return;
    previousMode.current=mode;
    cancel();
    if(mode!=='任务') return;
    // Composer commits mode changes without layout transitions. Wait until that
    // new task frame has actually been presented so the native snapshot matches
    // the live page underneath the lens instead of flashing the previous mode.
    const state=current.current,epoch=state.epoch;
    state.frame=requestAnimationFrame(()=>{
      state.frame=0;
      if(state.epoch===epoch)start();
    });
    return ()=>{if(state.epoch===epoch)cancel();};
  },[mode,start,cancel]);
  const onPress=event=>{
    if(mode==='任务' || (event.type==='pointerdown' && event.button!==0)
      || (event.type==='keydown' && (!['Enter',' '].includes(event.key)||event.repeat))) return;
    // Warm the renderer while the click/keypress is committing the new mode.
    // Capture and animation begin from the mode effect after the new frame paints.
    void loadRenderer().catch(()=>{});
  };
  return {onPointerDown:onPress,onKeyDown:onPress,onPointerEnter:()=>{void loadRenderer().catch(()=>{});},
    onPointerCancel:cancel};
}
