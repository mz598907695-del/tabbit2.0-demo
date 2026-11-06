// Only site origins reach the UI. Browser history stays in the local reader.
const siteKey = hostname => hostname.toLowerCase().replace(/^www\./, '');

export function toFrequentShortcuts(sites, catalog) {
  const knownSites = new Map(catalog.map(item => [siteKey(new URL(item.url).hostname), item]));
  const seen = new Set();
  return (Array.isArray(sites) ? sites : []).flatMap(site => {
    try {
      const url = new URL(site.url);
      const hostname = siteKey(url.hostname);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !hostname || seen.has(hostname)) return [];
      seen.add(hostname);
      const known = knownSites.get(hostname);
      return [{ id: `frequent-${hostname}`, label: known?.label || hostname, url: `${url.origin}/`, image: known?.image, description: hostname }];
    } catch { return []; }
  }).slice(0, 10);
}

/** Static demos cannot access a visitor's browser history. Keep the existing unavailable UI. */
export async function loadFrequentSites() {
  throw new Error('Browser history unavailable');
}
