import { invoke, isTauri } from '@tauri-apps/api/core';

// Development-only measurements, armed by the main entry during performance work.
// The production build never imports this module.
export function installInteractionMeasurements() {
  let generation = 0;
  const collect = event => {
    const button = event.target.closest?.('button');
    if (!button || !button.matches('.vertical-mode-toggle,.theme-trigger,.overlay-close,.overlay-appearance-option,.page-indicator button')) return;
    const epoch = ++generation, label = button.getAttribute('aria-label') || button.textContent.trim();
    const began = performance.now(), gaps = [];
    let previous = began, resizes = 0;
    const observer = new ResizeObserver(() => resizes++);
    document.querySelectorAll('.board-grid').forEach(grid => observer.observe(grid));
    const tick = now => {
      if (epoch !== generation) { observer.disconnect(); return; }
      gaps.push(now - previous); previous = now;
      if (now - began < 800) { requestAnimationFrame(tick); return; }
      observer.disconnect();
      const record = { type:'interaction-performance', label, frames:gaps.length, maxGap:Math.round(Math.max(...gaps)), over25ms:gaps.filter(value => value > 25).length, resizes };
      if (isTauri()) void invoke('record_swipe_trace', { records:[record] }).catch(() => {});
      else console.debug('[interaction-performance]', record);
    };
    requestAnimationFrame(tick);
  };
  document.addEventListener('click', collect, true);
  return () => { generation++; document.removeEventListener('click', collect, true); };
}
