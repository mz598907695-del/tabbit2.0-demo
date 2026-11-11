import { siteIconFor, tabIconFor, tabSites } from '../favicons';
import newTabIcon from '../assets/new-tab.svg';
import organizeTabsIcon from '../assets/organize-tabs.svg';
import { BOOKMARKS_TAB_ID } from './tabs-data';

export function IconFont({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`iconfont icon-${name} ${className}`} aria-hidden="true" />;
}

export function OrganizeTabsMark({ className = "" }: { className?: string }) {
  return <span className={`organize-tabs-mark ${className}`} aria-hidden="true"><img src={organizeTabsIcon} alt=""/><span className="organize-tabs-center"/></span>;
}

export function TokenIcon({ src, className = "" }: { src: string; className?: string }) {
  const mask = `url("${src}")`;
  return <span className={`token-icon ${className}`} style={{ WebkitMaskImage: mask, maskImage: mask }} aria-hidden="true"/>;
}

export function TabFavicon({ id, className = "tab-icon" }: { id: string; className?: string }) {
  if (id === BOOKMARKS_TAB_ID) return <span className={`${className} solid-star-icon bookmark-tab-icon`} aria-hidden="true"/>;
  const src = tabIconFor(id);
  const site = tabSites[id];
  return src === newTabIcon
    ? <span className={`${className} new-tab-page-icon`} aria-hidden="true" />
    : <img className={className} data-site={site} src={src} alt="" draggable={false} />;
}

export function SiteFavicon({ site }: { site: string }) {
  const src = siteIconFor(site);
  if (!src) return <IconFont name="diqiu"/>;
  return <img data-site={site} src={src} alt="" draggable={false}/>;
}

export function VerticalToggleIcon() {
  return <svg className="vertical-toggle-icon" width="16" height="16" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M2,35.5L2,12.5C2,8.9101489,4.910148899999999,6,8.5,6L39.5,6C43.089851,6,46,8.9101489,46,12.5L46,35.5C46,39.089851,43.089851,42,39.5,42L8.5,42C4.910148899999999,42,2,39.089851,2,35.5ZM6,35.5Q6,38,8.5,38L39.5,38Q42,38,42,35.5L42,12.5Q42,10,39.5,10L8.5,10Q6,10,6,12.5L6,35.5Z" fillRule="evenodd" fill="currentColor"/>
    <rect className="vertical-toggle-bar" x="9" y="13" width="8" height="22" rx="2" fill="currentColor"/>
  </svg>;
}
