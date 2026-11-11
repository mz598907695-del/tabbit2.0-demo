import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function modules(host = {}) {
  const cache = new Map();
  const load = file => {
    if(cache.has(file)) return cache.get(file).exports;
    const module = {exports:{}};
    cache.set(file,module);
    if(file.endsWith('.json')) return module.exports=JSON.parse(readFileSync(file,'utf8'));
    const output = ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(output,{...host,module,exports:module.exports,require:name=>load(resolve(dirname(file),name.endsWith('.json')?name:`${name}.ts`))},{filename:file});
    return module.exports;
  };
  return load;
}
function storage(initial={}) {
  const values=new Map(Object.entries(initial));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
}

test('fresh packaged defaults retain the curated gallery theme and system color preference',()=>{
  const load=modules(),store=storage();
  load(resolve('src/demoDefaults.ts')).initializeDemoDefaults(store,true);
  const api=load(resolve('src/windowAppearance.ts'));
  assert.equal(api.readWindowAppearance(store),'system');
  assert.equal(api.resolveWindowAppearance(api.readWindowAppearance(store),true),'dark');
  assert.equal(api.resolveWindowAppearance(api.readWindowAppearance(store),false),'light');
  const preferences=JSON.parse(store.getItem('personalized-home-2-0-preferences'));
  assert.equal(load(resolve('src/themeSelection.ts')).resolveThemeSource(preferences.theme,preferences.themeSource),'gallery');
  assert.match(preferences.theme,/^wallpaper-/);
  assert.ok(['light','dark'].includes(preferences.appearance));
});

test('packaged initialization preserves an existing explicit appearance',()=>{
  for(const mode of ['light','dark','system']) {
    const load=modules(),store=storage({'tabbit-window-appearance-v1':mode});
    load(resolve('src/demoDefaults.ts')).initializeDemoDefaults(store,true);
    assert.equal(load(resolve('src/windowAppearance.ts')).readWindowAppearance(store),mode);
  }
});

test('system changes update content tokens and the native callback with the same mode',()=>{
  const media=new EventTarget();media.matches=true;
  const document={documentElement:{dataset:{}}};
  const api=modules({document,window:{matchMedia:()=>media}})(resolve('src/windowAppearance.ts'));
  const native=[];
  const release=api.watchExistingTokenMode('system',mode=>{native.push(mode);assert.equal(document.documentElement.dataset.mode,mode);});
  assert.equal(document.documentElement.dataset.mode,'dark');
  media.matches=false;media.dispatchEvent(new Event('change'));
  assert.equal(document.documentElement.dataset.mode,'light');
  release();media.matches=true;media.dispatchEvent(new Event('change'));
  assert.deepEqual(native,['dark','light']);
});
