import { SPACE_GESTURE_EVENT } from '../../spaceTransition';
import { appearanceColorMix, appearanceFillMix, appearanceProgress, readSpaceAppearance } from './space-appearance-values.js';

const marker = 'data-space-appearance-preview';
const properties = ['color', 'background-color', 'box-shadow', 'border-color', 'border-width', 'filter', 'backdrop-filter', '-webkit-backdrop-filter'];
const material = '.personalized-home :is(.tb-composer-surface, .promotion-inline-carousel, .corner-promotion .promotion-card)';
const groups = [
  ['.content-container', null], ['.content-container', '::after'], ['.container-fill', '::after'],
  ['.personalized-home .board-card', null], ['.personalized-home .board-card', '::before', true], ['.personalized-home .board-card', '::after'],
  [material, '::before', true], [material, '::after'],
  ['.personalized-home .aiw-navigation', null], ['.personalized-home .aiw-launcher', null],
  ['.personalized-home .theme-trigger', null], ['.personalized-home .board-item-label', null],
  ['.personalized-home .tb-composer-modes', null], ['.personalized-home .tb-composer-modes', '::before'],
  ['.personalized-home .brand-mark-default', null],
];

function palette(element, prefix) {
  const style = getComputedStyle(element), result = new Map();
  for (let i = 0; i < style.length; i++) {
    const name = style[i];
    if (!name.startsWith(prefix)) continue;
    const value = style.getPropertyValue(name).trim();
    if (CSS.supports('color', value)) result.set(name, value);
  }
  return result;
}

function capture(doc, mode) {
  const root = doc.documentElement;
  root.dataset.mode = mode;
  const homes = [...doc.querySelectorAll('.personalized-home')];
  homes.forEach(home => { home.dataset.theme = mode; });
  const home = homes.find(element => element.classList.contains('new-tab-page')) || homes[0];
  return {
    root:palette(root, '--color-'), home:home ? palette(home, '--') : new Map(),
    veil:getComputedStyle(root).getPropertyValue('--color-bg-global-mask').trim(),
    groups:groups.map(([selector, pseudo, fill]) => {
      const element = doc.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element, pseudo);
      const values = Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)]));
      if (selector.includes('brand-mark-default')) values.opacity = style.opacity;
      return { values, fill:fill ? style.getPropertyValue('--home-content-surface-fill').trim() : null };
    }),
  };
}

function createPreviewSheet(doc, fromMode, toMode) {
  const root = doc.documentElement;
  const originalMode = root.getAttribute('data-mode');
  const homes = [...doc.querySelectorAll('.personalized-home')].map(element => [element, element.getAttribute('data-theme')]);
  const sampling = doc.createElement('style');
  sampling.textContent = 'html[data-space-appearance-sampling] *,html[data-space-appearance-sampling] *::before,html[data-space-appearance-sampling] *::after{transition:none!important}';
  doc.head.append(sampling);
  root.setAttribute('data-space-appearance-sampling', '');
  let from, to;
  try { from = capture(doc, fromMode); to = capture(doc, toMode); }
  finally {
    if (originalMode === null) root.removeAttribute('data-mode'); else root.setAttribute('data-mode', originalMode);
    homes.forEach(([element, theme]) => { if (theme === null) element.removeAttribute('data-theme'); else element.setAttribute('data-theme', theme); });
    root.removeAttribute('data-space-appearance-sampling'); sampling.remove();
  }
  const scope = `html[${marker}]`;
  const declarations = (a, b, skipInherited = false) => [...a].filter(([name, value]) => b.has(name) && b.get(name) !== value
    && (!skipInherited || (!name.startsWith('--color-') && !name.startsWith('--nine-'))))
    .map(([name, value]) => `${name}:${appearanceColorMix(value, b.get(name))}!important`).join(';');
  const css = [`${scope}{${declarations(from.root, to.root)};--color-bg-global-mask:${appearanceFillMix(from.veil, to.veil)}!important}`,
    `${scope} .personalized-home{${declarations(from.home, to.home, true)}}`];
  groups.forEach(([selector, pseudo], index) => {
    const a = from.groups[index], b = to.groups[index];
    if (!a || !b) return;
    const changed = properties.filter(property => a.values[property] !== b.values[property]);
    if (a.values.opacity !== b.values.opacity) changed.push('opacity');
    const fill = a.fill && b.fill && a.fill !== b.fill ? appearanceFillMix(a.fill, b.fill) : null;
    if (!changed.length && !fill) return;
    const name = `spaceAppearance${index}`;
    const frame = values => changed.map(property => `${property}:${values[property]}`).join(';');
    css.push(`@keyframes ${name}{from{${frame(a.values)}}to{${frame(b.values)}}}`);
    css.push(`${scope} ${selector}${pseudo || ''}{animation:${name} 1s linear calc(-1s * var(--space-appearance-progress,0)) 1 normal both paused!important;${fill ? `--home-content-surface-fill:${fill}!important;` : ''}${selector.includes('brand-mark-default') ? 'mix-blend-mode:normal!important;' : ''}}`);
  });
  const sheet = doc.createElement('style');
  sheet.dataset.spaceAppearance = '';
  sheet.textContent = css.join('\n');
  doc.head.append(sheet);
  root.setAttribute(marker, '');
  return sheet;
}

/** No screenshots or duplicate content. Only one CSS progress value changes
 * during a gesture; endpoint styles are sampled once and restored before paint. */
export function createSpaceAppearanceTransition({ getCurrent, storage = localStorage, doc = document }) {
  const root = doc.documentElement;
  let active = null, frame = 0, fallback = 0;
  const apply = value => {
    if (active) active.progress = value;
    root.style.setProperty('--space-appearance-progress', String(value));
  };
  const clear = () => {
    cancelAnimationFrame(frame); clearTimeout(fallback);
    frame = 0; fallback = 0;
    active?.sheet.remove(); active = null;
    root.removeAttribute(marker); root.style.removeProperty('--space-appearance-progress');
  };
  function handoff() {
    if (!active) return;
    const current = getCurrent(), id = String(current.spaceId);
    if (!active.committing) { if (id !== active.fromId) clear(); return; }
    if (id !== active.fromId && id !== active.toId) { clear(); return; }
    if (id === active.toId && current.mode === active.toMode && active.finished) clear();
    else if (id === active.toId && !fallback) fallback = window.setTimeout(() => {
      fallback = 0;
      if (!active) return;
      if (getCurrent().mode === active.toMode) clear();
      else animate(0, 240, clear);
    }, 1500);
  }
  function animate(target, duration, done) {
    cancelAnimationFrame(frame);
    const start = active?.progress || 0, began = performance.now();
    const tick = now => {
      if (!active) return;
      const fraction = Math.min(1, (now - began) / Math.max(1, duration));
      apply(start + (target - start) * (1 - (1 - fraction) ** 3));
      if (fraction < 1) frame = requestAnimationFrame(tick);
      else done?.();
    };
    frame = requestAnimationFrame(tick);
  }
  function gesture(event) {
    const detail = event.detail;
    if (!detail) {
      if (active && !active.committing) animate(0, 240, clear);
      return;
    }
    const current = getCurrent();
    if (String(current.spaceId) !== detail.fromSpaceId) return;
    if (!active || active.toId !== detail.toSpaceId) {
      clear();
      const toMode = readSpaceAppearance(storage, detail.toSpaceId, matchMedia('(prefers-color-scheme: dark)').matches);
      if (toMode === current.mode) return;
      active = { fromId:detail.fromSpaceId, toId:detail.toSpaceId, toMode, progress:0, committing:false,
        finished:false, sheet:createPreviewSheet(doc, current.mode, toMode) };
    }
    cancelAnimationFrame(frame); clearTimeout(fallback); fallback = 0;
    const progress = appearanceProgress(detail.progress);
    if (detail.duration) {
      active.committing = true;
      animate(progress, detail.duration, () => { if (active) active.finished = true; handoff(); });
    } else {
      active.committing = false;
      active.finished = false;
      apply(progress);
    }
  }
  window.addEventListener(SPACE_GESTURE_EVENT, gesture);
  return { handoff, destroy() { window.removeEventListener(SPACE_GESTURE_EVENT, gesture); clear(); } };
}
