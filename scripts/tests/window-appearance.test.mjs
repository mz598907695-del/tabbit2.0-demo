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

test('theme fill slider maps display endpoints and exact authored defaults',()=>{
  const api=modules()(resolve('src/themeFillPalette.ts'));
  assert.equal(api.sliderToFillOpacity(0),20);
  assert.equal(api.sliderToFillOpacity(100),80);
  assert.equal(api.fillOpacityToSlider(20),0);
  assert.equal(api.fillOpacityToSlider(80),100);
  for(const actual of [20,40,60,80]) {
    assert.ok(Math.abs(api.sliderToFillOpacity(api.fillOpacityToSlider(actual))-actual)<1e-10);
  }
});

test('fresh theme fill defaults reproduce the approved eight light and dark palettes',()=>{
  const api=modules()(resolve('src/themeFillPalette.ts'));
  const palette=api.readFillPalette(storage());
  assert.equal(Object.keys(palette).length,8);
  for(const modes of Object.values(palette)) {
    assert.equal(modes.light.opacity,60);
    assert.equal(modes.dark.opacity,40);
  }
  assert.equal(api.resolveFillColor('#47b2ff','light',palette),'#3a88fe');
  assert.equal(api.resolveFillColor('#47b2ff','dark',palette),'#245cb0');
  assert.equal(api.resolveFillColor('#f2f7ff','dark',palette),'#404040');
});

test('a saved fill override preserves its opposite mode and all other theme defaults',()=>{
  const api=modules()(resolve('src/themeFillPalette.ts'));
  const palette=api.readFillPalette(storage({[api.THEME_FILL_PALETTE_KEY]:JSON.stringify({'蓝色':{light:{color:'#123456',opacity:55}}})}));
  assert.equal(palette['蓝色'].light.color,'#123456');
  assert.equal(palette['蓝色'].light.opacity,55);
  assert.equal(palette['蓝色'].dark.color,'#245cb0');
  assert.equal(palette['粉色'].light.color,'#f6a8ff');
  assert.equal(api.resolveFillOpacity('#47b2ff','dark',palette,0),40);
});

test('fresh packaged defaults retain the captured color theme and system color preference',()=>{
  const load=modules(),store=storage();
  load(resolve('src/demoDefaults.ts')).initializeDemoDefaults(store,true);
  const api=load(resolve('src/windowAppearance.ts'));
  assert.equal(api.readWindowAppearance(store),'system');
  assert.equal(api.resolveWindowAppearance(api.readWindowAppearance(store),true),'dark');
  assert.equal(api.resolveWindowAppearance(api.readWindowAppearance(store),false),'light');
  const preferences=JSON.parse(store.getItem('personalized-home-2-0-preferences'));
  const captured=JSON.parse(JSON.parse(readFileSync(resolve('src/demo-defaults.json'),'utf8')).storage['personalized-home-2-0-preferences']);
  assert.equal(load(resolve('src/themeSelection.ts')).resolveThemeSource(preferences.theme,preferences.themeSource),'color');
  assert.equal(preferences.theme,captured.theme);
  assert.equal(preferences.appearance,captured.appearance);
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
