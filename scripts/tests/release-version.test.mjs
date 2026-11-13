import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareVersions, prepareReleaseVersion } from '../lib/release-version.mjs';

function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'tabbit-ci-version-test-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'src-tauri'));
  for(const file of ['package.json','src-tauri/tauri.conf.json'])writeFileSync(join(root,file),JSON.stringify({version:'0.1.9'}));
  writeFileSync(join(root,'package-lock.json'),JSON.stringify({version:'0.1.9',packages:{'':{version:'0.1.9'},'node_modules/example':{version:'9.9.9'}}}));
  writeFileSync(join(root,'src-tauri/Cargo.toml'),'[package]\nname = "tabbit-2-demo"\nversion = "0.1.9"\n\n[dependencies]\nexample = "1"\n');
  writeFileSync(join(root,'src-tauri/Cargo.lock'),'[[package]]\nname = "example"\nversion = "9.9.9"\n\n[[package]]\nname = "tabbit-2-demo"\nversion = "0.1.9"\n');
  return root;
}

test('CI version preparation updates app versions without changing dependency versions',t=>{
  const root=fixture(t);prepareReleaseVersion(root,'0.1.10','0.1.9');
  for(const file of ['package.json','package-lock.json','src-tauri/tauri.conf.json'])assert.equal(JSON.parse(readFileSync(join(root,file),'utf8')).version,'0.1.10');
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
  assert.equal(lock.packages[''].version,'0.1.10');assert.equal(lock.packages['node_modules/example'].version,'9.9.9');
  assert.match(readFileSync(join(root,'src-tauri/Cargo.lock'),'utf8'),/name = "example"\nversion = "9.9.9"/);
  assert.match(readFileSync(join(root,'src-tauri/Cargo.lock'),'utf8'),/name = "tabbit-2-demo"\nversion = "0.1.10"/);
});

test('CI refuses reused, older and malformed versions before modifying the checkout',t=>{
  const root=fixture(t),before=readFileSync(join(root,'package.json'),'utf8');
  for(const version of ['0.1.9','0.1.8','v0.1.10','0.01.10','0.1.10; echo test','0.1.10-beta'])assert.throws(()=>prepareReleaseVersion(root,version,'0.1.9'));
  assert.equal(readFileSync(join(root,'package.json'),'utf8'),before);
  assert.equal(compareVersions('0.1.10','0.1.9'),1);
});

test('inconsistent Cargo metadata is rejected without partially updating frontend versions',t=>{
  const root=fixture(t),before=readFileSync(join(root,'package.json'),'utf8');
  writeFileSync(join(root,'src-tauri/Cargo.toml'),'[package]\nversion = "0.1.8"\n');
  assert.throws(()=>prepareReleaseVersion(root,'0.1.10','0.1.9'),/disagree/);
  assert.equal(readFileSync(join(root,'package.json'),'utf8'),before);
});
