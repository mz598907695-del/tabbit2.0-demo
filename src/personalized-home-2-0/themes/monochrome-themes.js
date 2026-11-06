// The two retained directions from docs/research/shader-selection-50.json.
// Effects are deliberately adapted for quiet, monochrome homepage backgrounds.
export const monochromeThemes = [
  { reference: '07', label: '引力微尘', effect: 'antigravity', mode: 'dark', source: 'https://www.reactbits.dev/backgrounds/antigravity' },
  { reference: '39', label: '静水微澜', effect: 'water', mode: 'light', simulation: 'water', source: 'https://threejs.org/examples/webgpu_compute_water.html' },
].map(theme => ({
  ...theme,
  id: `mono-${theme.reference}`,
  color: theme.mode === 'dark' ? '#191919' : '#F4F4F4',
  preview: `/personalized-home-2-0/asset/themes/monochrome/${theme.reference}.png`,
}));

export const getMonochromeTheme = id => monochromeThemes.find(theme => theme.id === id);

// Map retired effects directly to the retained wallpaper with the same appearance.
export const retiredShaderThemes = {
  'prism-rose': 'mono-39', 'prism-violet': 'mono-39', 'prism-mint': 'mono-39',
  'prism-peach': 'mono-39', 'prism-ice': 'mono-39', 'prism-lime': 'mono-39',
  'mono-10': 'mono-39', 'mono-11': 'mono-39', 'mono-13': 'mono-07',
  'mono-21': 'mono-07', 'mono-26': 'mono-07', 'mono-33': 'mono-07',
  'mono-34': 'mono-39', 'mono-35': 'mono-39',
};
