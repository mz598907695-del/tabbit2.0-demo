import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { SHOCKWAVE_DURATION } from '../../src/personalized-home-2-0/effects/shockwave-math.js';

register('data:text/javascript,'+encodeURIComponent(`export async function load(url,context,next){
  if(url.endsWith('.css'))return{format:'module',source:'',shortCircuit:true};
  return next(url,context);
}`),import.meta.url);
const {playTaskShockwave}=await import('../../src/personalized-home-2-0/effects/task-shockwave.js');

class Events extends EventTarget {
  listeners=new Map();
  addEventListener(type,fn,options){this.listeners.set(fn+type,{type,fn,options});super.addEventListener(type,fn,options);}
  removeEventListener(type,fn,options){this.listeners.delete(fn+type);super.removeEventListener(type,fn,options);}
}

function rendererHost(t) {
  const original=new Map(),frames=new Map(),children=[],calls={draws:0,deletedTextures:0,lost:false};
  const gl=new Proxy({
    getShaderParameter:()=>true,getProgramParameter:()=>true,
    getExtension:()=>({loseContext(){calls.lost=true;}}),
    drawArrays(){calls.draws++;},deleteTexture(){calls.deletedTextures++;},
  },{get(target,key){
    if(key in target)return target[key];
    if(/^[A-Z_0-9]+$/.test(key))return 1;
    if(/^(create|getUniform)/.test(key))return()=>({});
    return()=>{};
  }});
  class Canvas extends Events {
    style={};dataset={};width=0;height=0;
    getContext(type){return type==='webgl2'?gl:null;}
    setAttribute(){}
    remove(){const index=children.indexOf(this);if(index!==-1)children.splice(index,1);}
  }
  const region={isConnected:true,closest:()=>null,querySelectorAll:()=>[],
    getBoundingClientRect:()=>({x:0,y:0,left:0,top:0,right:1280,bottom:800,width:1280,height:800}),dataset:{mode:'light'}};
  const doc=new Events();doc.documentElement=region;doc.createElement=()=>new Canvas();doc.body={append:canvas=>children.push(canvas)};
  const win=new Events();let id=0;
  const globals={document:doc,window:win,devicePixelRatio:2,matchMedia:()=>({matches:false}),
    getComputedStyle:()=>({borderRadius:'18px'}),requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:value=>frames.delete(value)};
  for(const [name,value]of Object.entries(globals)){original.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});}
  t.after(()=>{for(const [name,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  return {region,children,calls,doc,win,frames,tick(offset=16){const [key,fn]=frames.entries().next().value;frames.delete(key);fn(performance.now()+offset);}};
}

test('halo paints before a pending screenshot resolves and cancellation releases resources',async t=>{
  const host=rendererHost(t);let resolve;
  const cancel=playTaskShockwave({region:host.region,origin:{x:640,y:400},capture:()=>new Promise(done=>{resolve=done;})});
  assert.equal(host.children.length,1,'press must mount the halo synchronously');
  assert.equal(host.children[0].dataset.snapshot,'pending');
  host.tick();assert.equal(host.calls.draws,1,'the first frame must not await a snapshot');
  cancel();assert.equal(host.children.length,0);assert.equal(host.frames.size,0);
  assert.equal(host.calls.deletedTextures,2);assert.equal(host.calls.lost,true);
  assert.equal(host.win.listeners.size+host.doc.listeners.size,0);
  const image={src:'late-snapshot'};resolve(image);
  await new Promise(done=>setImmediate(done));
  assert.equal(image.src,'');assert.equal(host.children.length,0,'late screenshots must not resurrect a cancelled effect');
});

test('a ready snapshot enriches the same running wave without restarting its first frame',async t=>{
  const host=rendererHost(t);let resolve;
  playTaskShockwave({region:host.region,origin:{x:640,y:400},capture:()=>new Promise(done=>{resolve=done;})});
  const canvas=host.children[0];host.tick();const first=canvas.dataset.firstFrameMs;
  resolve({src:'ready-snapshot'});await new Promise(done=>setImmediate(done));
  assert.equal(host.children[0],canvas);assert.equal(canvas.dataset.snapshot,'native');
  assert.equal(canvas.dataset.firstFrameMs,first);assert.equal(host.frames.size,1);
  host.tick(SHOCKWAVE_DURATION+100);assert.equal(host.children.length,0);assert.equal(host.calls.lost,true);
});
