import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyMinisignSignature, verifyUpdateArtifacts } from '../verify-update-artifacts.mjs';

const encode = (value) => Buffer.from(value).toString('base64');
const data = Buffer.from('test');
const version = '2.0.0';
// Independent interoperability vector from tauri-plugin-updater 2.14.1's
// offline_tests: `tauri signer sign --app-version 2.0.0` on the bytes `test`.
const publicKey = encode('untrusted comment: minisign public key: A49EF4746FA6E6D7\nRWTX5qZvdPSepDGWg2bz8n6ArQnBMwgQK1geVosorcbLzcunD+KJ+cYe');
const signature = encode('untrusted comment: signature from tauri secret key\nRUTX5qZvdPSepPF2zsjvP/L/TQtBLRnWRvaq+4omK1UEugtQp/USrGiI1v762sDy3id3aor7bRC9ETyeot6lMHHrWoZ5hjUM1Qc=\ntrusted comment: timestamp:1791649051\tfile:payload\tversion:2.0.0\nDDq2CLOEl5cQmC2eJRHlnZPVViOZsu1CjpPKQoei4A/XBfkDqGO0B+QMrcrHgEQ5qV3mne75tdFWhJpqUXh9AA==');

function synthetic({ comment = 'timestamp:1\tfile:test\tversion:2.0.0', prehashed = true } = {}) {
  const keys = generateKeyPairSync('ed25519');
  const keyId = Buffer.from('12345678');
  const rawKey = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const publicKey = encode(`untrusted comment: test public key\n${encode(Buffer.concat([Buffer.from('Ed'), keyId, rawKey]))}\n`);
  const payload = prehashed ? createHash('blake2b512').update(data).digest() : data;
  const signed = sign(null, payload, keys.privateKey);
  const global = sign(null, Buffer.concat([signed, Buffer.from(comment)]), keys.privateKey);
  const signature = encode(`untrusted comment: fixture signature\n${encode(Buffer.concat([Buffer.from(prehashed ? 'ED' : 'Ed'), keyId, signed]))}\ntrusted comment: ${comment}\n${encode(global)}\n`);
  return { publicKey, signature };
}

test('accepts a real Tauri signature and its authenticated release version', () => {
  assert.deepEqual(verifyMinisignSignature({ data, publicKey, signature, version }), { version });
});

test('rejects an altered archive and a different announced version', () => {
  assert.throws(() => verifyMinisignSignature({ data: Buffer.from('test!'), publicKey, signature, version }), /Archive signature verification failed/);
  assert.throws(() => verifyMinisignSignature({ data, publicKey, signature, version: '2.0.1' }), /Signed version does not match/);
});

test('authenticates the trusted comment before trusting its claimed version', () => {
  const forged = encode(Buffer.from(signature, 'base64').toString('utf8').replace('version:2.0.0', 'version:2.0.1'));
  assert.throws(() => verifyMinisignSignature({ data, publicKey, signature: forged, version: '2.0.1' }), /Trusted comment signature verification failed/);
});

test('requires an unambiguous signed version field, not a substring of a filename', () => {
  for (const comment of ['timestamp:1\tfile:version:2.0.0', 'timestamp:1\tversion:2.0.0\tversion:2.0.0']) {
    assert.throws(() => verifyMinisignSignature({ data, version, ...synthetic({ comment }) }), /exactly one signed version/);
  }
});

test('verifies the actual public key even when an attacker copies its key ID', () => {
  const a = synthetic();
  const b = synthetic();
  assert.throws(() => verifyMinisignSignature({ data, version, signature: a.signature, publicKey: b.publicKey }), /Archive signature verification failed/);
});

test('supports signed legacy payloads and a signed v-prefixed version like Tauri', () => {
  assert.deepEqual(verifyMinisignSignature({ data, version, ...synthetic({ prehashed: false, comment: 'version:v2.0.0' }) }), { version });
});

test('rejects malformed base64, invalid lengths, and unsupported algorithms', () => {
  assert.throws(() => verifyMinisignSignature({ data, publicKey, signature: `${signature}!`, version }), /Invalid encoding/);
  const lines = Buffer.from(signature, 'base64').toString('utf8').split('\n');
  lines[1] = encode(Buffer.from('too short'));
  assert.throws(() => verifyMinisignSignature({ data, publicKey, signature: encode(lines.join('\n')), version }), /signature length/);
  const invalid = Buffer.from(signature, 'base64').toString('utf8').split('\n');
  const bytes = Buffer.from(invalid[1], 'base64');
  bytes.write('XX');
  invalid[1] = encode(bytes);
  assert.throws(() => verifyMinisignSignature({ data, publicKey, signature: encode(invalid.join('\n')), version }), /Unsupported minisign signature algorithm/);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'tabbit-release-verification-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'release', version);
  await mkdir(join(root, 'src-tauri'), { recursive: true });
  await mkdir(directory, { recursive: true });
  const config = { version, plugins: { updater: { pubkey: publicKey, requireSignedVersion: true } } };
  const archiveName = `tabbit-2-demo_${version}_aarch64.app.tar.gz`;
  const files = [archiveName, `${archiveName}.sig`, `Tabbit-2-Demo-${version}-arm64.dmg`, 'latest.json'];
  const manifest = { version, platforms: { 'darwin-aarch64': {
    url: `https://github.com/mz598907695-del/tabbit-demo-updates/releases/download/v${version}/${archiveName}`,
    signature,
  } } };
  await Promise.all([
    writeFile(join(root, 'src-tauri/tauri.conf.json'), JSON.stringify(config)),
    writeFile(join(directory, archiveName), data),
    writeFile(join(directory, `${archiveName}.sig`), `${signature}\n`),
    writeFile(join(directory, files[2]), 'synthetic DMG fixture'),
    writeFile(join(directory, 'latest.json'), JSON.stringify(manifest)),
  ]);
  return { root, directory, archiveName, files, manifest, config };
}

test('verifies a complete release directory against the configured updater key', async (t) => {
  const f = await fixture(t);
  const result = await verifyUpdateArtifacts({ root: f.root, version });
  assert.equal(result.version, version);
  assert.equal(result.platform, 'darwin-aarch64');
  assert.deepEqual(result.files, f.files);
  assert.deepEqual(await verifyUpdateArtifacts({ root: f.root }), result);
});

test('requires all four release artifacts', async (t) => {
  for (let index = 0; index < 4; index++) {
    await t.test(`missing artifact ${index}`, async (t) => {
      const f = await fixture(t);
      await rm(join(f.directory, f.files[index]));
      await assert.rejects(verifyUpdateArtifacts({ root: f.root, version }), /Missing release artifact/);
    });
  }
});

test('rejects empty files and symlinked release artifacts', async (t) => {
  const f = await fixture(t);
  const dmg = join(f.directory, f.files[2]);
  await writeFile(dmg, '');
  await assert.rejects(verifyUpdateArtifacts({ root: f.root, version }), /nonempty regular file/);
  await rm(dmg);
  await symlink(join(f.directory, f.archiveName), dmg);
  await assert.rejects(verifyUpdateArtifacts({ root: f.root, version }), /nonempty regular file/);
});

test('rejects manifest inconsistencies before publication', async (t) => {
  const cases = [
    ['wrong version', (m) => { m.version = '2.0.1'; }, /Manifest version/],
    ['wrong platform', (m) => { m.platforms = { 'darwin-x86_64': m.platforms['darwin-aarch64'] }; }, /only the darwin-aarch64/],
    ['extra platform', (m) => { m.platforms['darwin-x86_64'] = m.platforms['darwin-aarch64']; }, /only the darwin-aarch64/],
    ['wrong repository', (m) => { m.platforms['darwin-aarch64'].url = m.platforms['darwin-aarch64'].url.replace('tabbit-demo-updates', 'another-repo'); }, /public release URL/],
    ['wrong URL version', (m) => { m.platforms['darwin-aarch64'].url = m.platforms['darwin-aarch64'].url.replace('/v2.0.0/', '/v1.0.0/'); }, /public release URL/],
    ['wrong signature', (m) => { m.platforms['darwin-aarch64'].signature = 'AAAA'; }, /does not match the .sig file/],
  ];
  for (const [name, mutate, expected] of cases) {
    await t.test(name, async (t) => {
      const f = await fixture(t);
      mutate(f.manifest);
      await writeFile(join(f.directory, 'latest.json'), JSON.stringify(f.manifest));
      await assert.rejects(verifyUpdateArtifacts({ root: f.root, version }), expected);
    });
  }
});

test('rejects tampered files even with a consistent manifest and signature file', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.directory, f.archiveName), Buffer.concat([await readFile(join(f.directory, f.archiveName)), Buffer.from('!')]));
  await assert.rejects(verifyUpdateArtifacts({ root: f.root, version }), /Archive signature verification failed/);
});

test('rejects version drift and weakened signed-version configuration', async (t) => {
  const f = await fixture(t);
  await assert.rejects(verifyUpdateArtifacts({ root: f.root, version: '2.0.1' }), /does not match tauri.conf/);
  await assert.rejects(verifyUpdateArtifacts({ root: f.root, version: '../2.0.0' }), /X.Y.Z format/);
  f.config.plugins.updater.requireSignedVersion = false;
  await writeFile(join(f.root, 'src-tauri/tauri.conf.json'), JSON.stringify(f.config));
  await assert.rejects(verifyUpdateArtifacts({ root: f.root, version }), /must require a signed version/);
});
