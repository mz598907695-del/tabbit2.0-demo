import test from 'node:test';
import assert from 'node:assert/strict';
import { readWallpapers, validateWallpaperFile, MAX_WALLPAPER_BYTES, refreshWallpaperVideoPoster } from '../../src/personalized-home-2-0/themes/wallpapers.js';

const id=n=>`wallpaper-00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const record=(n,createdAt=n)=>({id:id(n),name:`image ${n}`,blob:new Blob(['image'],{type:'image/png'}),createdAt});

// Exercise key selection, transaction completion and failure paths without a DOM.
// The same operation is checked against real IndexedDB in desktop diagnostics.
function database(t,records,{failGet=false,failPut=false}={}) {
  const original=globalThis.indexedDB, reads=[], state={closed:0,completed:0};
  const db={close(){state.closed++;},transaction(){
    let pending=0,failed=false;
    const tx={objectStore:()=>store};
    const enqueue=(kind,result,key)=>{const req={};pending++;reads.push([kind,key]);queueMicrotask(()=>{
      if(failed)return;
      if((failGet&&kind==='get')||(failPut&&kind==='put')){failed=true;tx.error=null;tx.onerror?.({target:{error:new Error('read failed')}});return;}
      if(kind==='put'){const index=records.findIndex(record=>record.id===result.id);if(index<0)records.push(result);else records[index]=result;}
      req.result=result;req.onsuccess?.();pending--;
      if(!pending){state.completed++;tx.oncomplete?.();}
    });return req;};
    const store={getAll:()=>enqueue('getAll',[...records]),getAllKeys:()=>enqueue('keys',records.map(r=>r.id)),get:key=>enqueue('get',records.find(r=>r.id===key),key),put:record=>enqueue('put',record,record.id)};
    return tx;
  }};
  globalThis.indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}};
  t.after(()=>{if(original===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=original;});
  return {reads,state};
}

test('promoted wallpaper blobs stay unread while personal uploads are sorted and validated',async t=>{
  const promoted=Array.from({length:43},(_,n)=>record(n));
  const mine=[record(44,200),record(45,100),{...record(46),blob:'invalid'}];
  const {reads,state}=database(t,[...promoted,...mine]);
  const result=await readWallpapers({excludeIds:new Set(promoted.map(r=>r.id))});
  assert.deepEqual(result.map(r=>r.id),[id(44),id(45)]);
  assert.equal(reads.filter(([kind])=>kind==='getAll').length,0);
  assert.deepEqual(reads.filter(([kind])=>kind==='get').map(([,key])=>key),mine.map(r=>r.id));
  assert.equal(state.completed,1);assert.equal(state.closed,1);
});

test('an all-promoted library finishes without fetching any blobs',async t=>{
  const records=[record(1),record(2)];const {reads,state}=database(t,records);
  assert.deepEqual(await readWallpapers({excludeIds:new Set(records.map(r=>r.id))}),[]);
  assert.deepEqual(reads,[['keys',undefined]]);assert.equal(state.closed,1);
});

test('the public unfiltered read retains all valid records',async t=>{
  database(t,[record(1,30),record(2,20)]);
  assert.deepEqual((await readWallpapers()).map(r=>r.id),[id(1),id(2)]);
});

test('a failed selected read rejects and still closes its database',async t=>{
  const {state}=database(t,[record(1)],{failGet:true});
  await assert.rejects(readWallpapers({excludeIds:new Set([id(2)])}),/read failed/);
  assert.equal(state.closed,1);assert.equal(state.completed,0);
});

test('upload validation keeps original bytes and rejects mismatched or oversized images',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0]);
  const file=new File([bytes],'picture.png',{type:'image/png'});
  const value=await validateWallpaperFile(file,{decode:async()=>({width:16,height:9})});
  assert.equal(value.blob,file);assert.equal(value.name,'picture');
  await assert.rejects(validateWallpaperFile(new File([bytes],'bad.jpg',{type:'image/jpeg'})),e=>e.code==='invalid-image');
  await assert.rejects(validateWallpaperFile(new Blob([new Uint8Array(MAX_WALLPAPER_BYTES+1)],{type:'image/png'})),e=>e.code==='too-large');
});


test('old video covers upgrade once while original bytes, names and dates stay intact',async t=>{
  const old={...record(80),blob:new Blob(['original video'],{type:'video/mp4'}),poster:new Blob(['black cover'],{type:'image/jpeg'})};
  const {reads}=database(t,[old]);const cover=new Blob(['decoded cover'],{type:'image/jpeg'});let decodes=0;
  const decode=async()=>{decodes++;return{poster:cover};};
  const first=refreshWallpaperVideoPoster(old,{decode}),second=refreshWallpaperVideoPoster(old,{decode});
  assert.equal(first,second);const refreshed=await first;
  assert.equal(decodes,1);assert.equal(refreshed.posterVersion,2);assert.equal(refreshed.poster,cover);
  assert.equal(refreshed.blob,old.blob);assert.equal(refreshed.name,old.name);assert.equal(refreshed.createdAt,old.createdAt);
  assert.equal((await readWallpapers())[0].poster,cover);assert.equal(reads.filter(([kind])=>kind==='put').length,1);
  assert.equal(await refreshWallpaperVideoPoster(refreshed,{decode}),refreshed);assert.equal(decodes,1);
});

test('a cover repair does not resurrect a video deleted while decoding',async t=>{
  const old={...record(81),blob:new Blob(['video'],{type:'video/mp4'})};const {reads}=database(t,[]);
  const result=await refreshWallpaperVideoPoster(old,{decode:async()=>({poster:new Blob(['cover'],{type:'image/jpeg'})})});
  assert.equal(result,null);assert.equal(reads.some(([kind])=>kind==='put'),false);
});

test('a failed cover write leaves the old cover intact and can retry',async t=>{
  const old={...record(82),blob:new Blob(['video'],{type:'video/mp4'}),poster:new Blob(['old'],{type:'image/jpeg'})};
  database(t,[old],{failPut:true});let decodes=0;const decode=async()=>{decodes++;return{poster:new Blob(['new'],{type:'image/jpeg'})};};
  await assert.rejects(refreshWallpaperVideoPoster(old,{decode}),/read failed/);
  await assert.rejects(refreshWallpaperVideoPoster(old,{decode}),/read failed/);
  assert.equal(decodes,2);assert.equal((await readWallpapers())[0].poster,old.poster);
});
