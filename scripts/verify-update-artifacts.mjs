import { createHash, createPublicKey, verify } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UPDATE_REPOSITORY = 'https://github.com/mz598907695-del/tabbit-demo-updates';
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });

function decodeBase64(value, label) {
  if (typeof value !== 'string' || !value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`Invalid base64 ${label}`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error(`Invalid base64 ${label}`);
  return bytes;
}

function decodeText(value, label) {
  try {
    return utf8.decode(decodeBase64(value, label));
  } catch {
    throw new Error(`Invalid encoding for ${label}`);
  }
}

function parseSignature(publicKey, signature) {
  const keyLines = decodeText(publicKey, 'updater public key').trimEnd().split(/\r?\n/);
  if (keyLines.length !== 2 || !keyLines[0].startsWith('untrusted comment: ')) {
    throw new Error('Invalid minisign public key');
  }
  const key = decodeBase64(keyLines[1], 'minisign public key');
  if (key.length !== 42 || !['Ed', 'ED'].includes(key.subarray(0, 2).toString('latin1'))) {
    throw new Error('Invalid minisign public key algorithm or length');
  }
  const lines = decodeText(signature, 'updater signature').trimEnd().split(/\r?\n/);
  if (lines.length !== 4 || !lines[0].startsWith('untrusted comment: ') || !lines[2].startsWith('trusted comment: ')) {
    throw new Error('Invalid minisign signature');
  }
  const signed = decodeBase64(lines[1], 'minisign signature');
  const globalSignature = decodeBase64(lines[3], 'minisign global signature');
  if (signed.length !== 74 || globalSignature.length !== 64) {
    throw new Error('Invalid minisign signature length');
  }
  const algorithm = signed.subarray(0, 2).toString('latin1');
  if (!['Ed', 'ED'].includes(algorithm)) throw new Error('Unsupported minisign signature algorithm');
  if (!key.subarray(2, 10).equals(signed.subarray(2, 10))) {
    throw new Error('Signature key ID does not match the configured updater public key');
  }
  return {
    key: createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, key.subarray(10)]), format: 'der', type: 'spki' }),
    signature: signed.subarray(10),
    globalSignature,
    trustedComment: lines[2].slice('trusted comment: '.length),
    prehashed: algorithm === 'ED',
  };
}

function verifyPayload(payload, parsed, version) {
  if (!RELEASE_VERSION.test(version)) throw new Error('Expected a release version in X.Y.Z format');
  if (!verify(null, payload, parsed.key, parsed.signature)) {
    throw new Error('Archive signature verification failed');
  }
  // Minisign authenticates the comment separately. Do not trust its version until
  // BOTH signatures pass. This matches minisign-verify and Tauri updater 2.14.1.
  const globalPayload = Buffer.concat([parsed.signature, Buffer.from(parsed.trustedComment, 'utf8')]);
  if (!verify(null, globalPayload, parsed.key, parsed.globalSignature)) {
    throw new Error('Trusted comment signature verification failed');
  }
  const versions = parsed.trustedComment.split('\t').filter((field) => field.startsWith('version:'));
  if (versions.length !== 1) throw new Error('Signature must contain exactly one signed version');
  const signedVersion = versions[0].slice('version:'.length).replace(/^v/, '');
  if (signedVersion !== version) throw new Error('Signed version does not match the release version');
  return { version };
}

/** Verify Tauri's base64-encoded minisign signature, including its signed version. */
export function verifyMinisignSignature({ data, signature, publicKey, version }) {
  const parsed = parseSignature(publicKey, signature);
  const payload = parsed.prehashed ? createHash('blake2b512').update(data).digest() : data;
  return verifyPayload(payload, parsed, version);
}

/** Verify the release directory before uploading any assets. The DMG is checked
 * for presence; the updater signature authenticates the .app.tar.gz archive. */
export async function verifyUpdateArtifacts({ root = ROOT, version } = {}) {
  const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  version ??= config.version;
  if (typeof version !== 'string' || !RELEASE_VERSION.test(version)) {
    throw new Error('Expected a release version in X.Y.Z format');
  }
  if (config.version !== version) throw new Error('Release version does not match tauri.conf.json');
  if (config.plugins?.updater?.requireSignedVersion !== true) {
    throw new Error('Updater must require a signed version');
  }
  const archiveName = `tabbit-2-demo_${version}_aarch64.app.tar.gz`;
  const files = [archiveName, `${archiveName}.sig`, `Tabbit-2-Demo-${version}-arm64.dmg`, 'latest.json'];
  const directory = join(root, 'release', version);
  for (const name of files) {
    const file = join(directory, name);
    let info;
    try {
      info = await lstat(file);
    } catch {
      throw new Error(`Missing release artifact: ${name}`);
    }
    if (!info.isFile() || info.size === 0) throw new Error(`Release artifact must be a nonempty regular file: ${name}`);
  }
  const manifest = JSON.parse(await readFile(join(directory, 'latest.json'), 'utf8'));
  if (manifest.version !== version) throw new Error('Manifest version does not match the release version');
  if (!manifest.platforms || Object.keys(manifest.platforms).length !== 1 || !manifest.platforms['darwin-aarch64']) {
    throw new Error('Manifest must contain only the darwin-aarch64 platform');
  }
  const platform = manifest.platforms['darwin-aarch64'];
  const expectedUrl = `${UPDATE_REPOSITORY}/releases/download/v${version}/${archiveName}`;
  if (platform.url !== expectedUrl) throw new Error('Manifest URL does not match the expected public release URL');
  const signature = (await readFile(join(directory, `${archiveName}.sig`), 'utf8')).trim();
  if (typeof platform.signature !== 'string' || platform.signature.trim() !== signature) {
    throw new Error('Manifest signature does not match the .sig file');
  }
  const parsed = parseSignature(config.plugins.updater.pubkey, signature);
  const archive = join(directory, archiveName);
  let payload;
  if (parsed.prehashed) {
    const hash = createHash('blake2b512');
    for await (const chunk of createReadStream(archive)) hash.update(chunk);
    payload = hash.digest();
  } else {
    // Tauri still supports legacy minisign signatures over the raw payload.
    payload = await readFile(archive);
  }
  verifyPayload(payload, parsed, version);
  return { version, platform: 'darwin-aarch64', directory, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { version: { type: 'string' } } });
    const result = await verifyUpdateArtifacts({ version: values.version });
    console.log(`Verified ${result.version}: updater archive, public key, signed version, manifest URL and all ${result.files.length} release files.`);
  } catch (error) {
    console.error(`Release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
