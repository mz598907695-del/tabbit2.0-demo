import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateAICardPackage, readAICardFile, importedAICardSize } from '../../src/personalized-home-2-0/board/ai-card-import.js';
const minimal = () => ({ schemaVersion:1,kind:'ai-card',artifact:{version:'1.0.0',runtimeApiVersion:2,renderer:'web-component',manifest:{surfaces:{card:{renderer:'web-component'}}},sourceCode:'export default class Clock extends HTMLElement {}'},catalog:{title:'时钟',description:'本地时钟',category:'tools',tags:[],icon:{kind:'text',value:'时'}} });
test('accepts real AI Card package and converts its initial grid size',()=>{
  const pkg=minimal(); assert.equal(validateAICardPackage(pkg),pkg);assert.deepEqual(importedAICardSize(pkg),{w:2,h:2});
});
test('rejects wrong package version and unsupported online sources',()=>{
  const pkg=minimal();pkg.schemaVersion=2;assert.throws(()=>validateAICardPackage(pkg),/schemaVersion/);
  pkg.schemaVersion=1;pkg.artifact.manifest.permissions={bridge:['fetchData']};assert.throws(()=>validateAICardPackage(pkg),/在线/);
});
test('requires modal permission declaration to agree with surfaces',()=>{
  const pkg=minimal();pkg.artifact.manifest.permissions={bridge:['openModal']};assert.throws(()=>validateAICardPackage(pkg),/modal/);
  pkg.artifact.manifest.surfaces.modal={renderer:'web-component'};assert.equal(validateAICardPackage(pkg),pkg);
});
test('file reader explains malformed JSON and invalid extensions',async()=>{
  await assert.rejects(readAICardFile({name:'test.html',size:1,text:async()=>''}),/json/);
  await assert.rejects(readAICardFile({name:'test.json',size:1,text:async()=>'{'}),/JSON 格式/);
  const pkg=minimal();assert.deepEqual(await readAICardFile({name:'test.json',size:100,text:async()=>JSON.stringify(pkg)}),pkg);
});
test('source is serialized into inert JSON and sandbox does not receive same-origin access',()=>{
  const runtime=fs.readFileSync(new URL('../../src/personalized-home-2-0/board/ImportedAICard.jsx',import.meta.url),'utf8');
  assert.match(runtime,/sandbox="allow-scripts"/);assert.doesNotMatch(runtime,/allow-same-origin/);assert.match(runtime,/connect-src 'none'/);
});
