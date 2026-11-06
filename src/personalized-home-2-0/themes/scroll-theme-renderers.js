// Renderer modules are loaded on demand so the homepage bundle stays unchanged
// for visitors who never pick a scroll-driven wallpaper.
// Contract: create(canvas) → { resize(width, height, dpr), render({ p, time, layout }), dispose() }
export function loadScrollRenderer(theme) {
  switch (theme.renderer) {
    case 'dive': return import('./dive-renderer.js').then(module => module.createDiveRenderer);
    case 'hairline': return import('./hairline-renderer.js').then(module => module.createHairlineRenderer);
    case 'airplane': return import('./airplane-renderer.js').then(module => module.createAirplaneRenderer);
    case 'suzhou': return import('./suzhou-renderer.js').then(module => module.createSuzhouRenderer);
    case 'dandelion': return import('./dandelion-renderer.js').then(module => module.createDandelionRenderer);
    case 'route66': return import('./route66-renderer.js').then(module => module.createRoute66Renderer);
    case 'rocket': return import('./rocket-renderer.js').then(module => module.createRocketRenderer);
    default: return import('./sunrise-renderer.js').then(module => module.createSunriseRenderer);
  }
}

const previews = new Map();

/** One representative still per theme, rendered by the live renderer (no bitmap assets). */
export function scrollThemePreview(theme, width = 380, height = 300) {
  if (!previews.has(theme.id)) {
    previews.set(theme.id, loadScrollRenderer(theme).then(async create => {
      const canvas = document.createElement('canvas');
      const renderer = create(canvas);
      await renderer.ready; // e.g. a web font the artwork needs
      try {
        renderer.resize(width, height, 1);
        renderer.render({ p: theme.previewAt, time: 3.4, layout: { avoidHalf: 0 }, still: true });
        if (!theme.pixel) return canvas.toDataURL('image/jpeg', 0.9);
        // Pixel art is rendered small; enlarge it without smoothing so the thumbnail stays crisp.
        const big = document.createElement('canvas');
        big.width = width; big.height = height;
        const bigContext = big.getContext('2d');
        bigContext.imageSmoothingEnabled = false;
        bigContext.drawImage(canvas, 0, 0, width, height);
        return big.toDataURL('image/png');
      } finally { renderer.dispose(); }
    }).catch(() => { previews.delete(theme.id); return ''; }));
  }
  return previews.get(theme.id);
}
