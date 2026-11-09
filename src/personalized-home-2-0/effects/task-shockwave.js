import { invoke, isTauri } from '@tauri-apps/api/core';
import { createFullscreenProgram, createFullscreenTriangle } from '../themes/gl-utils.js';
import { getShockwaveFrame, getShockwavePixelRatio } from './shockwave-math.js';
import { SHOCKWAVE_FRAGMENT } from './shockwave-shader.js';
import { SHOCKWAVE_SETTINGS, shockwavePalette } from './shockwave-settings.js';
import './task-shockwave.css';

const running = new WeakMap();
let pendingCapture=null;
const LINE_SELECTORS = '.board-card,.tb-composer-surface,.promotion-card,.promotion-inline-carousel,.aiw-navigation,.tb-task-mount,.tb-task-chip,.tb-composer-modes';

async function capturePage(bounds, ratio) {
  if (!isTauri()) return null;
  const key=[bounds.x,bounds.y,bounds.width,bounds.height,ratio].join(':');
  if(!pendingCapture || pendingCapture.key!==key) {
    const entry={key,promise:invoke('capture_shockwave_content', { rect:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}, pixelRatio:ratio })};
    pendingCapture=entry;
    const clear=()=>{if(pendingCapture===entry)pendingCapture=null;};
    entry.promise.then(clear,clear);
  }
  // Rapid mode changes reuse one in-flight native capture, not a queue of PNGs.
  const bytes = await pendingCapture.promise;
  const url = URL.createObjectURL(new Blob([bytes], {type:'image/png'}));
  const image = new Image();
  try { image.src=url; await image.decode(); return image; }
  finally { URL.revokeObjectURL(url); }
}

function createLineMask(region, bounds, width, height) {
  const mask = document.createElement('canvas');
  mask.width=width; mask.height=height;
  const context=mask.getContext('2d');
  if (!context) return mask;
  context.scale(width/bounds.width,height/bounds.height);
  context.strokeStyle='#fff';
  for (const element of region.querySelectorAll(LINE_SELECTORS)) {
    const box=element.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom<bounds.top || box.top>bounds.bottom || box.right<bounds.left || box.left>bounds.right) continue;
    const style=getComputedStyle(element);
    if (style.visibility==='hidden') continue;
    context.lineWidth=Math.max(.5,parseFloat(style.borderTopWidth)||0);
    const radius=Math.min(parseFloat(style.borderTopLeftRadius)||0,box.width/2,box.height/2);
    context.beginPath();
    context.roundRect(box.left-bounds.left,box.top-bounds.top,box.width,box.height,radius);
    context.stroke();
  }
  return mask;
}

/** Imperative and finite: no React frame updates, no capture or GPU work idle. */
export function playTaskShockwave({ region, owner = region, origin, triggerTime = performance.now(), onFinish, capture = capturePage } = {}) {
  if (!region?.isConnected) return () => {};
  running.get(region)?.();
  const config=SHOCKWAVE_SETTINGS;
  const darkMode=()=>document.documentElement.dataset.mode==='dark';
  const bounds=region.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return () => {};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ratio=getShockwavePixelRatio(bounds.width,bounds.height,devicePixelRatio);
  const source={x:origin.x-bounds.left,y:origin.y-bounds.top};
  const canvas=document.createElement('canvas');
  canvas.className='task-shockwave-overlay';
  canvas.setAttribute('aria-hidden','true');
  const radius=getComputedStyle(region.closest('.content-container') || region).borderRadius;
  Object.assign(canvas.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`,borderRadius:radius});
  let stopped=false, frame=0, gl, program, triangle, mask;
  const textures=[];
  const live=()=>region.isConnected && owner?.isConnected && !owner.closest('[hidden],[aria-hidden="true"]');
  const cancel=() => {
    if (stopped) return;
    stopped=true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize',cancel);
    window.removeEventListener('scroll',cancel,true);
    window.removeEventListener('pagehide',cancel);
    document.removeEventListener('visibilitychange',visibility);
    document.removeEventListener('pointerdown',cancel,true);
    document.removeEventListener('keydown',cancel,true);
    canvas.removeEventListener('webglcontextlost',cancel);
    canvas.remove();
    if(gl) {
      textures.forEach(texture=>gl.deleteTexture(texture));
      if(triangle) { gl.deleteBuffer(triangle.buffer); gl.deleteVertexArray(triangle.vao); }
      if(program) gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    canvas.width=canvas.height=0;
    if(mask) mask.width=mask.height=0;
    if(running.get(region)===cancel) running.delete(region);
    onFinish?.();
  };
  const visibility=() => { if(document.hidden) cancel(); };
  running.set(region,cancel);
  window.addEventListener('resize',cancel);
  window.addEventListener('scroll',cancel,true);
  window.addEventListener('pagehide',cancel);
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener('pointerdown',cancel,true);
  document.addEventListener('keydown',cancel,true);

  function start() {
    // Request the old presented frame before adding the overlay. The halo does
    // not await PNG encoding or IPC; full refraction blends in when ready.
    let captureResult;
    try { captureResult=reduced ? null : capture(bounds,ratio); }
    catch(error) { captureResult=Promise.reject(error); }
    let uploadSnapshot=null;
    void Promise.resolve(captureResult).catch(error=>{
      if(import.meta.env.DEV) console.warn('Shockwave uses its light-only fallback:',error);
      return null;
    }).then(image=>{
      if(!image) {if(!stopped)canvas.dataset.snapshot='overlay';return;}
      if(stopped || !live() || !uploadSnapshot) {image.src='';return;}
      const current=region.getBoundingClientRect();
      if(['x','y','width','height'].some(key=>Math.abs(current[key]-bounds[key])>1)) {image.src='';cancel();return;}
      try {uploadSnapshot(image);}
      catch(error) {if(import.meta.env.DEV)console.warn('Shockwave snapshot unavailable:',error);}
      finally {image.src='';}
    });
    canvas.width=Math.round(bounds.width*ratio);canvas.height=Math.round(bounds.height*ratio);
    gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!gl) {cancel();return;}
    try {
      program=createFullscreenProgram(gl,SHOCKWAVE_FRAGMENT);
      triangle=createFullscreenTriangle(gl);
      gl.useProgram(program);
      const uniform=name=>gl.getUniformLocation(program,name);
      const texture=(unit,name)=>{
        const value=gl.createTexture();textures.push(value);
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,value);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
        gl.uniform1i(uniform(name),unit);
        return value;
      };
      const pageTexture=texture(0,'uPage'),lineTexture=texture(1,'uLines');
      const upload=(target,unit,image)=>{
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      };
      gl.uniform2f(uniform('uSize'),bounds.width,bounds.height);
      gl.uniform2f(uniform('uOrigin'),source.x,source.y);
      gl.uniform1f(uniform('uReduced'),reduced ? 1 : 0);
      const snapshotUniform=uniform('uSnapshot');
      gl.uniform1f(snapshotUniform,0);
      const radiusUniform=uniform('uRadius'),strengthUniform=uniform('uStrength'),colorsUniform=uniform('uColors[0]'),darkUniform=uniform('uDark');
      let colors=shockwavePalette(config,darkMode()?'dark':'light');
      let darkMix=darkMode()?1:0;
      let snapshotAt=-1;
      uploadSnapshot=image=>{
        upload(pageTexture,0,image);
        if(config.glint>0) {
          mask=createLineMask(region,bounds,canvas.width,canvas.height);
          upload(lineTexture,1,mask);
        }
        snapshotAt=performance.now();
        canvas.dataset.snapshot='native';
        canvas.dataset.snapshotAtMs=String(Math.round(snapshotAt-triggerTime));
      };
      canvas.dataset.snapshot=reduced?'overlay':'pending';
      canvas.dataset.origin=`${Math.round(source.x)},${Math.round(source.y)}`;
      canvas.addEventListener('webglcontextlost',cancel);
      document.body.append(canvas);
      const began=performance.now(),duration=reduced?600:config.duration;
      canvas.dataset.durationMs=String(duration);
      const controls=Object.fromEntries(['Brightness','LightOpacity','DarkOpacity','RingWidth','Lens','Bevel','Chromatic','Glint'].map(name=>[name,uniform(`u${name}`)]));
      let previous=began;
      const tick=now=>{
        if(stopped)return;
        const progress=Math.min(1,(now-began)/duration);
        if(progress>=1 || !live()) {cancel();return;}
        const parameters=config,dark=darkMode();
        const target=shockwavePalette(parameters,dark?'dark':'light');
        for(const [name,value]of Object.entries({Brightness:parameters.brightness,LightOpacity:parameters.opacity.light,DarkOpacity:parameters.opacity.dark,RingWidth:parameters.width,Lens:parameters.lens,Bevel:parameters.bevel,Chromatic:parameters.chromatic,Glint:parameters.glint}))gl.uniform1f(controls[name],value);
        const mix=1-Math.exp(-(now-previous)/100);
        colors=colors.map((value,index)=>value+(target[index]-value)*mix);
        darkMix+=((dark?1:0)-darkMix)*mix;
        previous=now;
        const state=getShockwaveFrame(progress,bounds.width,bounds.height,source,reduced,parameters.easing);
        gl.uniform1f(radiusUniform,state.radius);gl.uniform1f(strengthUniform,state.strength);
        gl.uniform1f(snapshotUniform,snapshotAt<0?0:Math.min(1,(now-snapshotAt)/100));
        gl.uniform3fv(colorsUniform,new Float32Array(colors));gl.uniform1f(darkUniform,darkMix);
        gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);
        if(!canvas.dataset.firstFrameMs)canvas.dataset.firstFrameMs=String(Math.round(now-triggerTime));
        canvas.dataset.progress=String(progress);
        frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
    } catch(error) {if(import.meta.env.DEV)console.warn('Shockwave unavailable:',error);cancel();}
  }
  void start();
  return cancel;
}
