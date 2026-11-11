// Confirmed animation parameters. Light and dark modes share one palette.
const colors=Object.freeze(['#af65ff','#7384ff','#c577ff','#ff96f5']);
export const SHOCKWAVE_SETTINGS=Object.freeze({
  duration:500,
  brightness:1.2,
  width:150,
  lens:14,
  bevel:8,
  chromatic:.2,
  glint:0,
  easing:'smooth',
  opacity:Object.freeze({light:.4,dark:.4}),
  colors:Object.freeze({light:colors,dark:colors}),
});

export const shockwavePalette=(config,mode)=>config.colors[mode].flatMap(color=>[
  parseInt(color.slice(1,3),16)/255,parseInt(color.slice(3,5),16)/255,parseInt(color.slice(5,7),16)/255,
]);
