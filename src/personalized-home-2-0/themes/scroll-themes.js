// Scroll-scrubbed wallpapers. The homepage scroll position plays a short story
// forward and backward, so each theme declares how far the page must scroll to
// reach its last frame. Only the id, name and colour here are visible to the
// preferences layer; the artwork itself is drawn live by a renderer module.
export const scrollThemes = [
  {
    id: 'scroll-sunrise',
    label: '海平线日出',
    mode: 'dark',
    // Night sky: keeps the interface in its dark appearance and is the first-paint colour.
    color: '#070b1f',
    renderer: 'sunrise',
    travel: { screens: 2.1, min: 1500, max: 2500 },
    previewAt: 0.55,
  },
  {
    id: 'scroll-dive',
    label: '纵身入海',
    mode: 'dark',
    color: '#0b3a5e',
    renderer: 'dive',
    pixel: true, // drawn on a small canvas and scaled with nearest-neighbour
    travel: { screens: 3.1, min: 2200, max: 3600 },
    previewAt: 0.2,
  },
  {
    id: 'scroll-rocket',
    label: '火箭升空',
    mode: 'dark',
    color: '#0b1230',
    renderer: 'rocket',
    travel: { screens: 3.2, min: 2300, max: 3800 },
    previewAt: 0.9,
  },
  {
    id: 'scroll-route66',
    label: '66 号公路',
    mode: 'dark',
    color: '#2a1530',
    renderer: 'route66',
    travel: { screens: 3, min: 2200, max: 3400 },
    previewAt: 0.06,
  },
  {
    id: 'scroll-dandelion',
    label: '蒲公英',
    mode: 'light',
    color: '#6ea3d0',
    renderer: 'dandelion',
    travel: { screens: 2.2, min: 1600, max: 2600 },
    previewAt: 0.3,
  },
  {
    id: 'scroll-airplane',
    label: '飞机舷窗',
    mode: 'dark',
    color: '#20242e',
    renderer: 'airplane',
    travel: { screens: 3.2, min: 2300, max: 3800 },
    previewAt: 0.58,
  },
  {
    id: 'scroll-suzhou',
    label: '园林四时',
    mode: 'light',
    color: '#e8e3d8',
    renderer: 'suzhou',
    travel: { screens: 3, min: 2200, max: 3400 },
    previewAt: 0,
  },
  {
    id: 'scroll-hairline',
    label: '发际线',
    mode: 'light',
    color: '#cfe4f7',
    renderer: 'hairline',
    travel: { screens: 2.4, min: 1700, max: 2800 },
    previewAt: 0.5,
  },
];

export const getScrollTheme = id => scrollThemes.find(theme => theme.id === id);

/** Pixels of page scrolling needed to play the whole story at this viewport height. */
export function scrollDistance(theme, viewportHeight) {
  const { screens, min, max } = theme.travel;
  return Math.round(Math.min(max, Math.max(min, viewportHeight * screens)));
}
