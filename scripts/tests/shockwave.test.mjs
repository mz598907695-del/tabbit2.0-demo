import test from 'node:test';
import { SHOCKWAVE_SETTINGS } from '../../src/personalized-home-2-0/effects/shockwave-settings.js';
import assert from 'node:assert/strict';
import {  getShockwaveFrame, getShockwavePixelRatio, SHOCKWAVE_DURATION, SHOCKWAVE_LENS_PIXELS, SHOCKWAVE_BEVEL_PIXELS } from '../../src/personalized-home-2-0/effects/shockwave-math.js';

test('a point-origin wave reaches every corner and fades completely', () => {
  const origin={x:310,y:620},width=1280,height=800;
  assert.equal(getShockwaveFrame(0,width,height,origin).strength,0);
  const end=getShockwaveFrame(1,width,height,origin);
  assert.equal(end.strength,0);
  for(const [x,y] of [[0,0],[width,0],[0,height],[width,height]]) assert.ok(end.radius>Math.hypot(x-origin.x,y-origin.y));
  let previous=0;
  for(let i=0;i<=100;i++) {
    const state=getShockwaveFrame(i/100,width,height,origin);
    assert.ok(state.radius>=previous);
    assert.ok(state.strength>=0&&state.strength<=1);
    previous=state.radius;
  }
});

test('the lens still crosses the central content after a 400ms native capture', () => {
  const width=1280,height=800,origin={x:640,y:440};
  const end=getShockwaveFrame(1,width,height,origin).radius;
  const early=getShockwaveFrame(200/SHOCKWAVE_DURATION,width,height,origin);
  const ready=getShockwaveFrame(400/SHOCKWAVE_DURATION,width,height,origin);
  const middle=getShockwaveFrame(.5,width,height,origin);
  assert.ok(early.radius/end<.2,'the wave leaves the input before the snapshot arrives');
  assert.ok(ready.radius/end<.6,'full refraction should still cross the central content');
  assert.ok(middle.radius/end>.4&&middle.radius/end<.6);
  assert.ok(ready.strength>.75);
  assert.ok(SHOCKWAVE_LENS_PIXELS>SHOCKWAVE_BEVEL_PIXELS,'the page lens must not be overpowered by edge refraction');
});

test('reduced motion holds the halo in place and fades at half strength', () => {
  const a=getShockwaveFrame(.25,800,600,{x:400,y:300},true);
  const b=getShockwaveFrame(.75,800,600,{x:400,y:300},true);
  assert.equal(a.radius,b.radius);
  assert.ok(Math.abs(a.strength-b.strength)<1e-8);
  assert.equal(getShockwaveFrame(.5,800,600,{x:400,y:300},true).strength,.5);
});

test('snapshot and GPU allocations stay below the retina and area limits', () => {
  assert.equal(getShockwavePixelRatio(800,600,3),2);
  assert.equal(getShockwavePixelRatio(800,600,1),1);
  for(const [width,height] of [[1920,1080],[3840,2160],[6000,4000]]) {
    const ratio=getShockwavePixelRatio(width,height,2);
    assert.ok(width*height*ratio*ratio<=4_000_001);
  }
  assert.equal(SHOCKWAVE_SETTINGS.colors.dark.length,4);
  assert.deepEqual(SHOCKWAVE_SETTINGS.colors.light,SHOCKWAVE_SETTINGS.colors.dark);
});
