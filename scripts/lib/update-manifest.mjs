export function createUpdateManifest({ version, url, signature, notes = '', platform = 'darwin-aarch64', date = new Date() }) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid release version');
  const source = new URL(url);
  if (source.protocol !== 'https:' || source.username || source.password) throw new Error('Update downloads must use HTTPS without embedded credentials');
  const signed = signature.trim();
  if (!signed || !/^[A-Za-z0-9+/=\r\n]+$/.test(signed)) throw new Error('Expected signature file contents, not a file path');
  if (!['darwin-aarch64','darwin-x86_64'].includes(platform)) throw new Error('Unsupported release platform');
  return { version, notes, pub_date:date.toISOString(), platforms:{ [platform]:{ url:source.href, signature:signed } } };
}
