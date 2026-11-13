import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function stableVersion(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Use a stable version such as 0.1.10, without a v prefix');
  return value.split('.').map(BigInt);
}
export function compareVersions(left, right) {
  const a=stableVersion(left),b=stableVersion(right);
  for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;
  return 0;
}

/** Prepare only the disposable CI checkout; never create a Git commit or tag. */
export function prepareReleaseVersion(root, version, latest) {
  stableVersion(version);
  if(compareVersions(version,latest)<=0)throw new Error(`Version must be newer than the published ${latest}`);
  const jsonPaths=['package.json','package-lock.json','src-tauri/tauri.conf.json'];
  const jsonFiles=jsonPaths.map(path=>[path,JSON.parse(readFileSync(join(root,path),'utf8'))]);
  const current=jsonFiles[0][1].version;
  if(compareVersions(version,current)<0)throw new Error('Release version cannot be older than the source version');
  if(jsonFiles.some(([,data])=>data.version!==current)||jsonFiles[1][1].packages[''].version!==current)throw new Error('Source version files disagree');
  const cargo=readFileSync(join(root,'src-tauri/Cargo.toml'),'utf8');
  const lock=readFileSync(join(root,'src-tauri/Cargo.lock'),'utf8');
  const cargoPattern=/(\[package\][\s\S]*?\nversion = ")([^"\n]+)(")/;
  const lockPattern=/(\[\[package\]\]\nname = "tabbit-2-demo"\nversion = ")([^"\n]+)(")/;
  if(cargo.match(cargoPattern)?.[2]!==current||lock.match(lockPattern)?.[2]!==current)throw new Error('Cargo and frontend versions disagree');
  // Validate all inputs before modifying any file.
  const writes=jsonFiles.map(([path,data])=>{
    data.version=version;
    if(path==='package-lock.json')data.packages[''].version=version;
    return [path,JSON.stringify(data,null,2)+'\n'];
  });
  writes.push(['src-tauri/Cargo.toml',cargo.replace(cargoPattern,(_,a,_old,b)=>a+version+b)]);
  writes.push(['src-tauri/Cargo.lock',lock.replace(lockPattern,(_,a,_old,b)=>a+version+b)]);
  for(const [path,content]of writes)writeFileSync(join(root,path),content);
}
