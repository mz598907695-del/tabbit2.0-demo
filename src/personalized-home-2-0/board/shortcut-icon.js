import { processedSiteIconFor } from '../../siteIcons';
import { shortcutCatalog } from './shortcut-catalog.js';

// Match full hosts, not registrable domains: Scholar and Maps are not Google Search.
export function shortcutHostname(value) {
  try {
    const input = String(value || '').trim();
    const url = new URL(input.startsWith('//') ? `https:${input}` : /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch { return ''; }
}

const localIcons = new Map(shortcutCatalog.map(item => [shortcutHostname(item.url), item.image]));
const legacyIcons = new Map(shortcutCatalog.filter(item => item.image.endsWith('.webp'))
  .map(item => [item.image.replace(/\.webp$/, '.png'), item.image]));
const currentIcon = image => legacyIcons.get(image) || image;

export function sanitizeShortcutCustomIcon(value) {
  return typeof value === 'string' && value.length <= 512 * 1024 && /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+={0,2}$/i.test(value)
    ? value : undefined;
}

/** Keep a custom upload through URL edits, but retire the previous site's artwork. */
export function shortcutIconFields(item, url, customIcon = item?.customIcon) {
  const hostname = shortcutHostname(url);
  const originalHostname = item?.iconHostname || shortcutHostname(item?.url);
  const sameSite = Boolean(hostname && hostname === originalHostname);
  return {
    customIcon: sanitizeShortcutCustomIcon(customIcon),
    iconHostname: hostname,
    image: sameSite ? currentIcon(item?.image) || localIcons.get(hostname) : localIcons.get(hostname),
    darkImage: sameSite ? item?.darkImage : undefined,
    key: sameSite ? item?.key || 'custom' : 'custom',
  };
}

function canLookUpOnline(hostname) {
  // Local URLs still work as shortcuts; their names need not leave the device.
  return hostname.includes('.') && !/^[\d.]+$/.test(hostname) && !hostname.includes(':')
    && !/\.(?:localhost|local|internal|test|invalid)$/.test(hostname);
}

export function getShortcutIconCandidates(item = {}, appearanceTheme = 'light') {
  const hostname = shortcutHostname(item.url);
  const matches = !item.iconHostname || item.iconHostname === hostname;
  const storedImage = matches ? currentIcon(appearanceTheme === 'dark' ? item.darkImage || item.image : item.image) : undefined;
  const candidates = [processedSiteIconFor(hostname, appearanceTheme), processedSiteIconFor(item.key, appearanceTheme), sanitizeShortcutCustomIcon(item.customIcon), storedImage, localIcons.get(hostname)];
  if (canLookUpOnline(hostname)) {
    // Ask for the highest useful resolution; providers return the best available source.
    // Only the hostname is sent, never paths, query strings or credentials.
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=256`);
    candidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`);
  }
  return [...new Set(candidates.filter(Boolean))];
}
