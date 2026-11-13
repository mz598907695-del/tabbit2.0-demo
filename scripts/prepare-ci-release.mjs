import { fileURLToPath } from 'node:url';
import { prepareReleaseVersion, stableVersion } from './lib/release-version.mjs';

if(process.env.GITHUB_ACTIONS!=='true')throw new Error('This version override is for disposable GitHub Actions checkouts only');
const version=process.argv[2]||'';
stableVersion(version);
const headers={Accept:'application/vnd.github+json','User-Agent':'Tabbit-team-release'};
if(process.env.TABBIT_RELEASE_TOKEN)headers.Authorization=`Bearer ${process.env.TABBIT_RELEASE_TOKEN}`;
const response=await fetch('https://api.github.com/repos/mz598907695-del/tabbit-demo-updates/releases/latest',{headers});
if(!response.ok)throw new Error(`Cannot verify latest public version: HTTP ${response.status}`);
const release=await response.json();
const latest=release.tag_name?.replace(/^v/,'');
stableVersion(latest||'');
prepareReleaseVersion(fileURLToPath(new URL('..',import.meta.url)),version,latest);
console.log(`Prepared ${version}; latest published version is ${latest}.`);
