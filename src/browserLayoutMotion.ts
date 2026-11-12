// Keep the sidebar's real width animation, while the expensive homepage uses
// one stable layout until it settles. Wallpaper/composer geometry follows once.
export const BROWSER_LAYOUT_SETTLED_EVENT = 'tabbit-browser-layout-settled';
let timer = 0;
let frozen: HTMLElement[] = [];

export function isBrowserLayoutChanging() {
  return document.documentElement.dataset.browserLayoutChanging === 'true';
}

export function beginBrowserLayoutChange(duration = 320) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.clearTimeout(timer);
  frozen.forEach(element => { element.removeAttribute('data-layout-fixed'); element.style.removeProperty('--layout-fixed-width'); });
  frozen = [...document.querySelectorAll<HTMLElement>('.home-layout')]
    .filter(element => element.getClientRects().length && element.getBoundingClientRect().width > 0);
  const widths = frozen.map(element => element.getBoundingClientRect().width);
  frozen.forEach((element, index) => {
    element.style.setProperty('--layout-fixed-width', `${widths[index]}px`);
    element.setAttribute('data-layout-fixed', '');
  });
  document.documentElement.dataset.browserLayoutChanging = 'true';
  timer = window.setTimeout(() => {
    frozen.forEach(element => { element.removeAttribute('data-layout-fixed'); element.style.removeProperty('--layout-fixed-width'); });
    frozen = [];
    delete document.documentElement.dataset.browserLayoutChanging;
    window.dispatchEvent(new Event(BROWSER_LAYOUT_SETTLED_EVENT));
    timer = 0;
  }, duration + 32);
}
