import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function components(version) {
  if (typeof version !== 'string' || !releaseVersion.test(version)) {
    throw new Error('Release version must be a plain X.Y.Z version without a prefix or suffix');
  }
  return version.split('.').map(BigInt);
}

export function compareReleaseVersions(left, right) {
  const a = components(left);
  const b = components(right);
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function tomlField(section, key, label) {
  const matches = [...section.matchAll(new RegExp(`^${key}\\s*=\\s*"([^"\\r\\n]*)"[\\t ]*(?:#.*)?$`, 'gm'))];
  if (matches.length !== 1) throw new Error(`${label} must contain exactly one ${key}`);
  return matches[0][1];
}

function updateTomlPackage(text, name, current, next, label, lockfile = false) {
  const header = lockfile ? /^\[\[package\]\][\t ]*\r?$/gm : /^\[package\][\t ]*\r?$/gm;
  const sections = [...text.matchAll(header)].map(match => {
    const start = match.index + match[0].length;
    const following = text.slice(start).search(/^\[/m);
    return { start, end: following === -1 ? text.length : start + following };
  });
  const targets = sections.filter(({ start, end }) => tomlField(text.slice(start, end), 'name', label) === name);
  if (targets.length !== 1) throw new Error(`${label} must contain exactly one package named ${name}`);
  const { start, end } = targets[0];
  const section = text.slice(start, end);
  if (tomlField(section, 'version', label) !== current) throw new Error(`${label} version does not match package.json`);
  return text.slice(0, start) + section.replace(/^(version\s*=\s*")[^"\r\n]*(")/m, `$1${next}$2`) + text.slice(end);
}

export function prepareReleaseVersion({ version, root = projectRoot }) {
  components(version);
  const files = ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
  const contents = files.map(file => readFileSync(join(root, file), 'utf8'));
  const [pkg, lock, tauri] = contents.slice(0, 3).map(text => JSON.parse(text));
  const current = pkg.version;
  if (compareReleaseVersions(version, current) <= 0) throw new Error(`Release version must be greater than ${current}`);
  if (!pkg.name || lock.name !== pkg.name || lock.packages?.['']?.name !== pkg.name) {
    throw new Error('package-lock.json root package does not match package.json');
  }
  if (lock.version !== current || lock.packages[''].version !== current || tauri.version !== current) {
    throw new Error('Package, lockfile and Tauri versions must agree before preparing a release');
  }

  // Validate every manifest before touching any file. Dependency versions stay unchanged.
  const cargo = updateTomlPackage(contents[3], pkg.name, current, version, 'Cargo.toml');
  const cargoLock = updateTomlPackage(contents[4], pkg.name, current, version, 'Cargo.lock', true);
  pkg.version = lock.version = lock.packages[''].version = tauri.version = version;
  const updated = [pkg, lock, tauri].map(value => JSON.stringify(value, null, 2) + '\n');
  updated.push(cargo, cargoLock);
  files.forEach((file, index) => writeFileSync(join(root, file), updated[index]));
  return { previousVersion: current, version, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { version: { type: 'string' }, root: { type: 'string' } } });
    const result = prepareReleaseVersion({ version: values.version, root: values.root && resolve(values.root) });
    console.log(`Prepared release ${result.previousVersion} → ${result.version} in ${result.files.length} manifests.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
