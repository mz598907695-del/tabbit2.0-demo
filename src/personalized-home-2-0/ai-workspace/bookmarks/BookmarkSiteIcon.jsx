import ShortcutIcon from '../../board/ShortcutIcon';

// Share the homepage's exact-host artwork, favicon fallbacks and resource cache.
export default function BookmarkSiteIcon({ node, size = 16 }) {
  return <span className="bkm-site-icon" aria-hidden="true" style={{ width: size, height: size }}>
    <ShortcutIcon item={{ url: node.url, label: node.title }} size={size}/>
  </span>;
}
