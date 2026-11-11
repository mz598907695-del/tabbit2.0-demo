import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { createUpdateManifest } from './lib/update-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options:{
  'skip-build':{ type:'boolean', default:false },
  'base-url':{ type:'string' },
  'notes':{ type:'string', default:'支持自动检查更新、后台下载和重启安装。' },
  'no-dmg':{ type:'boolean', default:false },
} });
if (process.platform !== 'darwin') throw new Error('This release script builds the macOS package');
const config = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const { version } = config;
const keyPath = process.env.TABBIT_UPDATER_KEY_PATH || join(homedir(), '.config/tabbit-demo-updater/signing.key');
if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !existsSync(keyPath)) throw new Error('Updater signing key is missing; keep it outside the repository');
const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY:process.env.TAURI_SIGNING_PRIVATE_KEY || keyPath, TAURI_SIGNING_PRIVATE_KEY_PASSWORD:process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' };
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd:root, env, stdio:'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
};
if (!values['skip-build']) run('npm', ['run','tauri','build','--','--bundles','app']);
const sourceApp = join(root, 'src-tauri/target/release/bundle/macos/tabbit-2-demo.app');
const plistVersion = spawnSync('/usr/libexec/PlistBuddy', ['-c','Print :CFBundleShortVersionString',join(sourceApp,'Contents/Info.plist')], { encoding:'utf8' });
if (plistVersion.status !== 0 || plistVersion.stdout.trim() !== version) throw new Error('Built application version does not match release configuration');
const platform = process.arch === 'arm64' ? 'darwin-aarch64' : 'darwin-x86_64';
const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const name = `tabbit-2-demo_${version}_${arch}.app.tar.gz`;
const output = join(root, 'release', version);
mkdirSync(output, { recursive:true });
const archive = join(output, name);
const baseUrl = values['base-url'] || `https://github.com/mz598907695-del/tabbit-demo-updates/releases/download/v${version}/`;
// Validate the destination before producing a package or invoking the signer.
createUpdateManifest({ version, url:new URL(name, baseUrl).href, signature:'AA==' });
const stage = mkdtempSync(join(tmpdir(), 'tabbit-update-release-'));
try {
  const app = join(stage, 'tabbit-2-demo.app');
  run('ditto', [sourceApp, app]);
  // Seal resources before archiving/signing: updater signatures cover the final app.
  // This preserves the local ad-hoc signing policy used for the demo installers.
  run('codesign', ['--force','--deep','--sign','-',app]);
  run('codesign', ['--verify','--deep','--strict',app]);
  run('tar', ['-czf',archive,'-C',stage,'tabbit-2-demo.app'], { env:{ ...env, COPYFILE_DISABLE:'1' } });
  const signingArgs = ['signer','sign','--app-version',version];
  const signingEnv = { ...env };
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
    signingArgs.push('--private-key-path', keyPath);
    delete signingEnv.TAURI_SIGNING_PRIVATE_KEY;
  }
  signingArgs.push(archive);
  run(join(root, 'node_modules/.bin/tauri'), signingArgs, { env:signingEnv });
  const signature = readFileSync(`${archive}.sig`, 'utf8');
  const manifest = createUpdateManifest({ version, url:new URL(name, baseUrl).href, signature, notes:values.notes, platform });
  writeFileSync(join(output, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n');
  if (!values['no-dmg']) {
    symlinkSync('/Applications', join(stage, 'Applications'));
    const dmg = join(output, `Tabbit-2-Demo-${version}-${process.arch}.dmg`);
    run('hdiutil', ['create','-ov','-volname','Tabbit 2 Demo','-srcfolder',stage,'-format','UDZO',dmg]);
    run('hdiutil', ['verify',dmg]);
  }
  console.log(`Release files are ready in ${output}. Nothing has been uploaded.`);
} finally { rmSync(stage, { recursive:true, force:true }); }
