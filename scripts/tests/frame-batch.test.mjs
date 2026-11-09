import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameBatch } from '../../src/personalized-home-2-0/board/frame-batch.js';

function clock() {
  let next = 0;
  const frames = new Map();
  return {
    requestAnimationFrame(fn) { const id=next++; frames.set(id,fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    tick() { const pending=[...frames.values()]; frames.clear(); pending.forEach(fn=>fn()); },
    get pending() { return frames.size; },
  };
}

test('120 drag samples preserve the latest preview and paint only once per frame', () => {
  const host=clock(), paints=[], batch=createFrameBatch(value=>paints.push(value),host);
  for(let i=0;i<120;i++)batch.schedule({x:i,y:i*2});
  assert.equal(host.pending,1); assert.equal(paints.length,0);
  host.tick(); assert.deepEqual(paints,[{x:119,y:238}]);
  batch.schedule({x:120,y:240}); host.tick();
  assert.deepEqual(paints.at(-1),{x:120,y:240}); assert.equal(host.pending,0);
});

test('release, escape and unmount can cancel a pending drag preview', () => {
  const host=clock(), paints=[], batch=createFrameBatch(value=>paints.push(value),host);
  batch.schedule('stale'); batch.cancel(); batch.cancel(); host.tick();
  assert.equal(host.pending,0); assert.deepEqual(paints,[]);
  batch.schedule('next drag'); host.tick(); assert.deepEqual(paints,['next drag']);
});

test('a paint callback can schedule the following frame without losing it', () => {
  const host=clock(), paints=[];
  const batch=createFrameBatch(value=>{paints.push(value);if(value===1)batch.schedule(2);},host);
  batch.schedule(1); host.tick(); assert.equal(host.pending,1); host.tick();
  assert.deepEqual(paints,[1,2]);
});
