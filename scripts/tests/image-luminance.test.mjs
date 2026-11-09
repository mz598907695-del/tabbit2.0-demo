import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyThemePixels } from '../../src/personalized-home-2-0/themes/image-luminance.js';

const pixel=(n,a=255)=>new Uint8ClampedArray([n,n,n,a]);
function previous(data) {
  const linear=channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;};
  let luminance=0,weight=0;
  for(let i=0;i<data.length;i+=4){const alpha=data[i+3]/255;luminance+=(.2126*linear(data[i])+.7152*linear(data[i+1])+.0722*linear(data[i+2]))*alpha;weight+=alpha;}
  return weight&&luminance/weight<.4?'dark':'light';
}

test('the .4 linear-light threshold and transparent pixels retain their behavior', () => {
  assert.equal(classifyThemePixels(pixel(169)),'dark');
  assert.equal(classifyThemePixels(pixel(170)),'light');
  assert.equal(classifyThemePixels(pixel(0,0)),'light');
  assert.equal(classifyThemePixels(new Uint8ClampedArray([255,255,255,0,0,0,0,255])),'dark');
  // Linear luminance, not the average of sRGB channel values.
  assert.equal(classifyThemePixels(new Uint8ClampedArray([0,0,0,255,255,255,255,255])),'light');
});

test('all 256 gray levels and 1000 deterministic RGBA images match the previous calculation', () => {
  for(let n=0;n<256;n++)assert.equal(classifyThemePixels(pixel(n)),previous(pixel(n)));
  let seed=85173;
  for(let sample=0;sample<1000;sample++){
    const data=new Uint8ClampedArray(64*4);
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}
    assert.equal(classifyThemePixels(data),previous(data));
  }
});
