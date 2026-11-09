// Run in the real Tauri app. Uses the existing visible Composer, preserves its
// draft and restores the selected mode/focus after bounded native/GPU checks.
import { playTaskShockwave } from '/src/personalized-home-2-0/effects/task-shockwave.js';
import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Composer } from '/src/personalized-home-2-0/Composer.jsx';
import { runIsolatedCheck } from './frame-check.js';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw new Error(message);};

export async function checkTaskShockwave() {
  const owner=[...document.querySelectorAll('.tb-composer-wrap')].find(element=>element.getClientRects().length&&!element.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(element).visibility!=='hidden');
  assert(owner,'没有可见输入框');
  const buttons=[...owner.querySelectorAll('.tb-composer-modes button')];
  const chat=buttons.find(button=>button.textContent==='对话');
  const task=buttons.find(button=>button.textContent==='任务');
  assert(chat&&task,'输入框没有任务切换');
  const wasTask=task.getAttribute('aria-pressed')==='true',focused=document.activeElement;
  const input=owner.querySelector('textarea'),draft=input?.value;
  const overlay=()=>document.querySelector('.task-shockwave-overlay');
  const until=async(predicate,timeout=5000)=>{
    const began=performance.now();
    while(!predicate()) {assert(performance.now()-began<timeout,'冲击波等待超时');await wait(12);}
  };
  try {
    if(wasTask) {chat.click();await wait(40);}
    const began=performance.now();
    task.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0,buttons:1}));
    await until(()=>overlay()?.dataset.firstFrameMs);
    const canvas=overlay(),gl=canvas.getContext('webgl2');
    assert(task.getAttribute('aria-pressed')!=='true','光环仍等切换任务后才启动');
    const pressStartMs=Number(canvas.dataset.firstFrameMs);
    const box=canvas.getBoundingClientRect();
    const region=owner.closest('.glass-surface')||document.documentElement;
    const bounds=region.getBoundingClientRect();
    assert(Math.abs(box.left-bounds.left)<1&&Math.abs(box.top-bounds.top)<1
      && Math.abs(box.width-bounds.width)<1&&Math.abs(box.height-bounds.height)<1,'光环没有覆盖整个窗口');
    task.click();
    await until(()=>canvas.dataset.snapshot==='native'||!canvas.isConnected,2000);
    assert(canvas.isConnected,'原生截图未在光环期间就绪');
    assert(canvas.dataset.snapshot==='native','完整效果没有获得原生页面截图');
    assert(getComputedStyle(canvas).pointerEvents==='none','动画拦截了交互');
    const info={pressStartMs,beforeTaskCommit:true,wholeWindow:true,snapshotReadyMs:Math.round(performance.now()-began),snapshot:canvas.dataset.snapshot,
      pixels:[canvas.width,canvas.height],origin:canvas.dataset.origin,glError:gl.getError()};
    assert(info.glError===0,'GPU 渲染出错');
    assert(canvas.width*canvas.height<=4_010_000,'超出截图像素预算');
    await until(()=>!overlay(),2000);
    await wait(40);
    assert(gl.isContextLost(),'GPU 上下文未释放');
    assert(input?.value===draft,'模式切换改变了输入草稿');
    const lifecycle=await runIsolatedCheck('/scripts/diagnostics/task-shockwave.js','checkTaskShockwaveInDocument');
    return {...info,...lifecycle};
  } finally {
    if(wasTask!== (task.getAttribute('aria-pressed')==='true')) {
      (wasTask?task:chat).click();
      await wait(1800);
    }
    focused?.focus({preventScroll:true});
  }
}

export async function checkTaskShockwaveInDocument() {
  const region=document.createElement('section');
  region.className='personalized-home';region.dataset.theme='light';
  region.style.cssText='position:fixed;inset:0;padding:150px 150px 0';
  document.body.append(region);
  const root=createRoot(region);
  let unmounted=false,stop;
  const overlay=()=>document.querySelector('.task-shockwave-overlay');
  const until=async(predicate,timeout=2500)=>{const began=performance.now();while(!predicate()){assert(performance.now()-began<timeout,'生命周期验证超时');await wait(12);}};
  try {
    flushSync(()=>root.render(createElement(StrictMode,null,createElement(Composer,{initialQuery:'保留草稿'}))));
    const buttons=[...region.querySelectorAll('.tb-composer-modes button')];
    const chat=buttons[0],task=buttons[1],input=region.querySelector('textarea');
    flushSync(()=>task.click());await until(overlay);
    const first=overlay(),gl=first.getContext('webgl2');
    flushSync(()=>chat.click());assert(!first.isConnected,'返回对话未取消光环');
    await wait(40);assert(gl.isContextLost(),'取消未释放 GPU');
    flushSync(()=>task.click());await until(overlay);await until(()=>!overlay());
    flushSync(()=>task.click());await wait(80);assert(!overlay(),'重复点击已选任务仍触发动画');
    assert(input.value==='保留草稿','模式切换改变草稿');

    let resolve;
    stop=playTaskShockwave({region,origin:{x:500,y:300},capture:()=>new Promise(done=>{resolve=done;})});
    stop();resolve(null);await wait(100);assert(!overlay(),'取消后旧截图又启动了动画');
    const original=window.matchMedia;
    let captures=0;
    try {
      window.matchMedia=query=>query==='(prefers-reduced-motion: reduce)'?{matches:true}:original.call(window,query);
      stop=playTaskShockwave({region,origin:{x:500,y:300},capture:()=>{captures++;return null;}});
    } finally {window.matchMedia=original;}
    await until(overlay);assert(overlay().dataset.snapshot==='overlay'&&captures===0,'减少动态效果仍捕获页面');
    await until(()=>!overlay(),1200);
    flushSync(()=>{chat.click();});await wait(30);flushSync(()=>task.click());
    flushSync(()=>root.unmount());unmounted=true;
    await wait(150);assert(!overlay(),'卸载后留下动画');
    return {cleanup:true,repeatedSelection:true,cancellation:true,draftPreserved:true,reducedMotion:true,strictMode:true,unmount:true};
  } finally {
    stop?.();if(!unmounted)flushSync(()=>root.unmount());region.remove();
  }
}
