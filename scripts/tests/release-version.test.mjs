import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compareReleaseVersions, prepareReleaseVersion } from '../prepare-release-version.mjs';

const manifests = ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
const json = value => JSON.stringify(value, null, 2) + '\n';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'tabbit-release-version-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src-tauri'));
  const contents = [
    json({ name: 'tabbit-2-demo', version: '0.1.9' }),
    json({ name: 'tabbit-2-demo', version: '0.1.9', lockfileVersion: 3, packages: {
      '': { name: 'tabbit-2-demo', version: '0.1.9' },
      'node_modules/example': { version: '0.1.9' },
    } }),
    json({ version: '0.1.9', identifier: 'com.tabbit.demo' }),
    '[package]\nname = "tabbit-2-demo"\nversion = "0.1.9" # application\n\n[dependencies]\nexample = "0.1.9"\n',
    '# generated\nversion = 4\n\n[[package]]\nname = "example"\nversion = "0.1.9"\n\n[[package]]\nname = "tabbit-2-demo"\nversion = "0.1.9"\ndependencies = [\n "example",\n]\n\n[[package]]\nname = "zebra"\nversion = "0.1.9"\n',
  ];
  manifests.forEach((file, index) => writeFileSync(join(root, file), contents[index]));
  return { root, snapshot: () => manifests.map(file => readFileSync(join(root, file), 'utf8')) };
}

test('release preparation synchronizes all application versions without changing dependencies', t => {
  const { root, snapshot } = fixture(t);
  assert.equal(prepareReleaseVersion({ root, version: '0.1.10' }).previousVersion, '0.1.9');
  const [pkg, lock, tauri, cargo, cargoLock] = snapshot();
  assert.equal(JSON.parse(pkg).version, '0.1.10');
  assert.equal(JSON.parse(lock).version, '0.1.10');
  assert.equal(JSON.parse(lock).packages[''].version, '0.1.10');
  assert.equal(JSON.parse(lock).packages['node_modules/example'].version, '0.1.9');
  assert.equal(JSON.parse(tauri).version, '0.1.10');
  assert.match(cargo, /version = "0\.1\.10" # application/);
  assert.match(cargo, /example = "0\.1\.9"/);
  assert.match(cargoLock, /name = "tabbit-2-demo"\nversion = "0\.1\.10"/);
  assert.match(cargoLock, /name = "example"\nversion = "0\.1\.9"/);
  assert.match(cargoLock, /name = "zebra"\nversion = "0\.1\.9"/);
});

test('version comparison handles numeric minor and major increments', () => {
  assert.equal(compareReleaseVersions('0.1.10', '0.1.9'), 1);
  assert.equal(compareReleaseVersions('0.2.0', '0.1.99'), 1);
  assert.equal(compareReleaseVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareReleaseVersions('0.1.9', '0.1.9'), 0);
});

test('invalid, equal and lower release versions never modify the checkout', t => {
  const { root, snapshot } = fixture(t);
  const before = snapshot();
  for (const version of [undefined, '', 'v0.1.10', '0.1', '0.1.10-beta', '0.1.10+build', '0.01.10', ' 0.1.10', '0.1.10\n', '0.1.9', '0.1.8', '0.0.99']) {
    assert.throws(() => prepareReleaseVersion({ root, version }), /version/i);
    assert.deepEqual(snapshot(), before);
  }
});

test('inconsistent manifests fail before writing any application version', t => {
  const { root, snapshot } = fixture(t);
  const cargoLock = join(root, 'src-tauri/Cargo.lock');
  writeFileSync(cargoLock, readFileSync(cargoLock, 'utf8').replace('name = "tabbit-2-demo"\nversion = "0.1.9"', 'name = "tabbit-2-demo"\nversion = "0.1.8"'));
  const before = snapshot();
  assert.throws(() => prepareReleaseVersion({ root, version: '0.1.10' }), /Cargo.lock version does not match/);
  assert.deepEqual(snapshot(), before);
});

test('missing or duplicate application lockfile entries are rejected without writes', t => {
  const { root, snapshot } = fixture(t);
  const path = join(root, 'src-tauri/Cargo.lock');
  const original = readFileSync(path, 'utf8');
  for (const content of [original.replace('name = "tabbit-2-demo"', 'name = "other-app"'), original + '\n[[package]]\nname = "tabbit-2-demo"\nversion = "0.1.9"\n']) {
    writeFileSync(path, content);
    const before = snapshot();
    assert.throws(() => prepareReleaseVersion({ root, version: '0.1.10' }), /exactly one package named/);
    assert.deepEqual(snapshot(), before);
  }
});

test('CLI prepares the supplied checkout and exits unsuccessfully for a repeated version', t => {
  const { root, snapshot } = fixture(t);
  const script = join(dirname(fileURLToPath(import.meta.url)), '../prepare-release-version.mjs');
  const first = spawnSync(process.execPath, [script, '--root', root, '--version', '0.2.0'], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /0\.1\.9 → 0\.2\.0/);
  const before = snapshot();
  const second = spawnSync(process.execPath, [script, '--root', root, '--version', '0.2.0'], { encoding: 'utf8' });
  assert.equal(second.status, 1);
  assert.match(second.stderr, /must be greater than/);
  assert.deepEqual(snapshot(), before);
});
