import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWallpaperVideo } from '../../src/personalized-home-2-0/themes/wallpaperVideoPlayback.js';
import { isVideoWallpaper, waitForWallpaperMedia, getVideoPosterTime } from '../../src/personalized-home-2-0/themes/wallpaper-video.js';
import { validateWallpaperFile, isStoredWallpaper, MAX_VIDEO_WALLPAPER_BYTES } from '../../src/personalized-home-2-0/themes/wallpapers.js';

function mediaDocument() {
  const observers=new Map(),listeners=new Set();
  const doc=new EventTarget();doc.hidden=false;
  const add=doc.addEventListener.bind(doc),remove=doc.removeEventListener.bind(doc);
  doc.addEventListener=(type,fn)=>{listeners.add(fn);add(type,fn);};
  doc.removeEventListener=(type,fn)=>{listeners.delete(fn);remove(type,fn);};
  doc.defaultView={IntersectionObserver:class{
    constructor(callback){this.callback=callback;}
    observe(video){this.video=video;observers.set(video,this);}
    disconnect(){observers.delete(this.video);}
  }};
  return {doc,listeners,observers,visible(video,value){observers.get(video).callback([{isIntersecting:value}]);}};
}
class Video extends EventTarget {
  constructor(doc){super();this.ownerDocument=doc;this.tagName='VIDEO';this.isConnected=true;this.readyState=4;this.duration=10;this.currentTime=0;this.paused=true;this.plays=0;}
  play(){this.plays++;this.paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();}
  pause(){this.paused=true;}
}

test('background copies autoplay silently, join the running frame and correct drift',()=>{
  const host=mediaDocument(),a=new Video(host.doc),b=new Video(host.doc);
  const stopA=registerWallpaperVideo(a,'one.mp4');host.visible(a,true);
  assert.equal(a.paused,false);assert.equal(a.muted,true);assert.equal(a.defaultMuted,true);assert.equal(a.volume,0);
  a.currentTime=3.5;
  const stopB=registerWallpaperVideo(b,'one.mp4');host.visible(b,true);
  assert.equal(b.currentTime,3.5);assert.equal(b.paused,false);
  b.currentTime=3.1;a.dispatchEvent(new Event('timeupdate'));assert.equal(b.currentTime,3.5);
  // Native loop wrap: the shortest circular drift wins.
  a.currentTime=.01;b.currentTime=9.99;a.dispatchEvent(new Event('timeupdate'));assert.equal(b.currentTime,9.99);
  stopA();stopB();assert.equal(host.listeners.size,0);assert.equal(host.observers.size,0);
});

test('hidden backgrounds pause and resume together; disposal removes playback listeners',()=>{
  const host=mediaDocument(),a=new Video(host.doc),b=new Video(host.doc);
  const stopA=registerWallpaperVideo(a,'one.mp4'),stopB=registerWallpaperVideo(b,'one.mp4');
  host.visible(a,true);host.visible(b,true);a.currentTime=b.currentTime=4.25;
  host.doc.hidden=true;host.doc.dispatchEvent(new Event('visibilitychange'));assert.ok(a.paused&&b.paused);
  host.doc.hidden=false;host.doc.dispatchEvent(new Event('visibilitychange'));assert.ok(!a.paused&&!b.paused);assert.equal(a.currentTime,4.25);
  host.visible(a,false);assert.equal(a.paused,true);assert.equal(b.paused,false);
  b.currentTime=5;host.visible(a,true);assert.equal(a.currentTime,5);
  stopA();const plays=a.plays;a.dispatchEvent(new Event('loadeddata'));assert.equal(a.plays,plays);
  stopB();assert.ok(a.paused&&b.paused);assert.equal(host.listeners.size,0);
});

test('different wallpapers and different documents keep independent clocks',()=>{
  const first=mediaDocument(),second=mediaDocument();
  const a=new Video(first.doc),b=new Video(first.doc),c=new Video(second.doc);
  const stops=[registerWallpaperVideo(a,'one.mp4'),registerWallpaperVideo(b,'two.mp4'),registerWallpaperVideo(c,'one.mp4')];
  first.visible(a,true);a.currentTime=6;first.visible(b,true);second.visible(c,true);
  assert.equal(b.currentTime,0);assert.equal(c.currentTime,0);stops.forEach(stop=>stop());
});

test('video readiness waits for decoded data; image readiness retains decode()',async()=>{
  const video=new Video(mediaDocument().doc);video.readyState=1;
  const ready=waitForWallpaperMedia(video);video.readyState=2;video.dispatchEvent(new Event('loadeddata'));await ready;
  const errorVideo=new Video(video.ownerDocument);errorVideo.readyState=0;
  const failed=waitForWallpaperMedia(errorVideo);errorVideo.dispatchEvent(new Event('error'));await assert.rejects(failed,/unavailable/);
  let decoded=false;await waitForWallpaperMedia({tagName:'IMG',decode:async()=>{decoded=true;}});assert.equal(decoded,true);
  assert.equal(isVideoWallpaper({mimeType:'video/mp4',url:'blob:local'}),true);
  assert.equal(isVideoWallpaper({url:'/loop.MOV?v=1'}),true);
  assert.equal(isVideoWallpaper({mimeType:'image/gif',url:'/animated.gif'}),false);
});

function mp4(brand='isom') {
  const bytes=new Uint8Array(24);new DataView(bytes.buffer).setUint32(0,24);
  bytes.set(new TextEncoder().encode('ftyp'+brand),4);return bytes;
}
const poster=new Blob(['cover'],{type:'image/jpeg'});
const decode=async()=>({width:160,height:90,poster});

test('MP4, MOV and WebM retain their bytes and save a still cover',async()=>{
  const webm=new Uint8Array([0x1a,0x45,0xdf,0xa3,...new TextEncoder().encode('webm')]);
  for(const [bytes,type,name]of [[mp4(),'video/mp4','loop.mp4'],[mp4('qt  '),'video/quicktime','loop.mov'],[webm,'video/webm','loop.webm']]){
    const file=new File([bytes],name,{type});const value=await validateWallpaperFile(file,{decode});
    assert.equal(value.blob,file);assert.equal(value.poster,poster);assert.equal(value.name,'loop');
    assert.equal(isStoredWallpaper({...value,id:'wallpaper-00000000-0000-0000-0000-000000000001',createdAt:1}),true);
  }
  const unnamedType=new File([mp4()],'LOOP.MP4');const value=await validateWallpaperFile(unnamedType,{decode});
  assert.equal(value.blob.type,'video/mp4');assert.deepEqual(await value.blob.arrayBuffer(),await unnamedType.arrayBuffer());
});

test('video validation rejects spoofing, unsupported decoding, missing covers and oversized files',async()=>{
  await assert.rejects(validateWallpaperFile(new File([mp4()],'fake.png',{type:'image/png'}),{decode}),e=>e.code==='invalid-image');
  const file=new File([mp4()],'loop.mp4',{type:'video/mp4'});
  await assert.rejects(validateWallpaperFile(file,{decode:async()=>{throw Error('bad codec');}}),e=>e.code==='decode-failed');
  await assert.rejects(validateWallpaperFile(file,{decode:async()=>({width:160,height:90})}),e=>e.code==='decode-failed');
  Object.defineProperty(file,'size',{value:MAX_VIDEO_WALLPAPER_BYTES+1});
  await assert.rejects(validateWallpaperFile(file,{decode}),e=>e.code==='too-large'&&e.message.includes('100 MB'));
});


test('poster sampling avoids time zero and can skip a black intro later in the video',()=>{
  assert.equal(getVideoPosterTime(12),1);
  assert.equal(getVideoPosterTime(60,1),21);
  assert.equal(getVideoPosterTime(60,2),39);
  assert.ok(getVideoPosterTime(.04)>0&&getVideoPosterTime(.04)<.04);
  assert.equal(getVideoPosterTime(Infinity),.1);
});
