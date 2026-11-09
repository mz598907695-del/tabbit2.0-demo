import { useCallback, useEffect, useRef } from 'react';

let renderer;
const loadRenderer=()=>renderer ||= import('./effects/task-shockwave.js').catch(error=>{renderer=null;throw error;});

export function useTaskShockwave(ownerRef, mode) {
  const current=useRef({epoch:0,cancel:null});
  const previousMode=useRef(mode);
  const pressed=useRef(false);
  const cancel=useCallback(()=>{
    const state=current.current;
    state.epoch++;
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
    const fromPress=pressed.current;
    pressed.current=false;
    if(mode==='任务') {if(!fromPress)start();}
    else cancel();
  },[mode,start,cancel]);
  const onPress=event=>{
    if(mode==='任务' || (event.type==='pointerdown' && event.button!==0)
      || (event.type==='keydown' && (!['Enter',' '].includes(event.key)||event.repeat))) return;
    pressed.current=true;
    start();
  };
  return {onPointerDown:onPress,onKeyDown:onPress,onPointerEnter:()=>{void loadRenderer().catch(()=>{});},
    onPointerCancel:()=>{pressed.current=false;cancel();}};
}
