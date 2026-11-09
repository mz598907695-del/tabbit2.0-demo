import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWallpaperVideoPresentation, getWallpaperVideoPresentation } from '../../src/personalized-home-2-0/themes/wallpaperVideoPresentation.js';
import { waitForWallpaperMedia } from '../../src/personalized-home-2-0/themes/wallpaper-video.js';

class Video extends EventTarget {
  constructor() {
    super(); this.tagName='VIDEO'; this.readyState=4; this.paused=true; this.seeking=false;
    this.style={}; this.dataset={}; this.poster='later-cover.jpg'; this.frames=new Map(); this.next=0;
    this.ownerDocument={defaultView:{matchMedia:()=>({matches:false})}};
  }
  removeAttribute(name) { if(name==='poster') this.poster=''; }
  requestVideoFrameCallback(callback) { const id=++this.next; this.frames.set(id,callback); return id; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  present() { const callbacks=[...this.frames.values()]; this.frames.clear(); callbacks.forEach(callback=>callback()); }
}

test('decoded data cannot reveal a poster or finish the handoff before a real frame', async()=>{
  const video=new Video();
  const dispose=prepareWallpaperVideoPresentation(video,{posterUrl:'later-cover.jpg',revealDuration:0});
  try {
    let finished=false;
    const ready=waitForWallpaperMedia(video).then(()=>{finished=true;});
    assert.equal(video.poster,''); assert.equal(video.style.opacity,'0');
    video.dispatchEvent(new Event('loadeddata'));
    await Promise.resolve();
    assert.equal(finished,false); assert.equal(video.style.opacity,'0');
    video.present();
    assert.equal(video.style.opacity,'1'); assert.equal(video.dataset.wallpaperVideoState,'presented');
    await ready;
    assert.equal(video.dataset.wallpaperVideoState,'ready'); assert.equal(video.poster,'');
  } finally { dispose(); }
  assert.equal(getWallpaperVideoPresentation(video),null);
});

test('a seek in progress waits for the aligned destination frame', async()=>{
  const video=new Video();
  const dispose=prepareWallpaperVideoPresentation(video,{revealDuration:0});
  try {
    video.seeking=true; video.present();
    assert.equal(video.style.opacity,'0');
    video.seeking=false; video.present();
    await waitForWallpaperMedia(video);
    assert.equal(video.style.opacity,'1');
  } finally { dispose(); }
});

test('StrictMode replay cancels old callbacks and does not reveal the next generation early',async()=>{
  const video=new Video();
  const first=prepareWallpaperVideoPresentation(video,{revealDuration:0});
  const abandoned=waitForWallpaperMedia(video), stale=[...video.frames.values()][0];
  first();
  await assert.rejects(abandoned,/cancelled/);
  assert.equal(video.frames.size,0);
  const second=prepareWallpaperVideoPresentation(video,{revealDuration:0});
  try {
    stale(); assert.equal(video.style.opacity,'0');
    video.present(); await waitForWallpaperMedia(video);
    assert.equal(video.dataset.wallpaperVideoState,'ready');
  } finally {second();}
});

test('covers remain available after a media failure, and pending frame work is released',async()=>{
  const video=new Video();
  const dispose=prepareWallpaperVideoPresentation(video,{posterUrl:'fallback.jpg',revealDuration:0});
  try {
    const ready=waitForWallpaperMedia(video);
    video.dispatchEvent(new Event('error'));
    await assert.rejects(ready,/unavailable/);
    assert.equal(video.poster,'fallback.jpg'); assert.equal(video.style.opacity,'1');
    assert.equal(video.frames.size,0); assert.equal(video.dataset.wallpaperVideoState,'error');
  } finally {dispose();}
});
