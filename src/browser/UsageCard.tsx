import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const defaults = {
  cardBorderWidth:0,cardBorderOpacity:.1,cardBorderColor:'#ffffff',cardFillColor:'#000000',cardFillOpacity:1,
  pixelsEnabled:true,pixelSize:3,pixelGap:2,pixelOpacity:.4,pixelDuration:8,pixelDensity:1,pixelColor:'#ffffff',pixelMulticolor:true,pixelColor2:'#00c7fc',pixelColor3:'#fffc41',pixelColor4:'#e991ff',
  remaining:78, padding:16, titleSize:13,
  amplitude:4, waves:2, irregularity:1, duration:2, animated:true, inward:true,
  glowWidth:160, glowBlur:24, glowOpacity:.35,
  transitionWidth:60, transitionBlur:24.5, transitionOpacity:.75,
  softWidth:39, softBlur:11.5, softOpacity:1, coreWidth:13, coreBlur:3, coreOpacity:.9,
  auraWidth:160,auraBlur:24,auraOpacity:.9,auraColor:'#0502a0',
  hazeWidth:101,hazeBlur:14,hazeOpacity:1,hazeColor:'#773edf',
  bridgeWidth:65,bridgeBlur:27.5,bridgeOpacity:1,bridgeColor:'#16a4ff',
  mistWidth:43,mistBlur:9.5,mistOpacity:.95,mistColor:'#19ffea',
  auraEnabled:true,hazeEnabled:true,glowEnabled:true,bridgeEnabled:true,transitionEnabled:true,mistEnabled:true,softEnabled:true,coreEnabled:true,
  fillStart:'#000000',fillMiddle:'#000000',fillEdge:'#000000',
  glowColor:'#2a56ec',transitionColor:'#ff81c7',lightTop:'#4741ff',lightMiddle:'#9fff28',lightAccent:'#f8ff0a',lightBottom:'#fff76b',coreColor:'#5bffec',
};

type Settings = typeof defaults;
type NumberKey = { [K in keyof Settings]:Settings[K] extends number ? K : never }[keyof Settings];
type ColorKey = { [K in keyof Settings]:Settings[K] extends string ? K : never }[keyof Settings];
type BooleanKey = { [K in keyof Settings]:Settings[K] extends boolean ? K : never }[keyof Settings];
const layers: {id:string; title:string; width:NumberKey; blur:NumberKey; opacity:NumberKey; color?:ColorKey; enabled:BooleanKey}[] = [
  {id:'aura',title:'1 · 玫红外晕',width:'auraWidth',blur:'auraBlur',opacity:'auraOpacity',color:'auraColor',enabled:'auraEnabled'},
  {id:'haze',title:'2 · 紫色雾光',width:'hazeWidth',blur:'hazeBlur',opacity:'hazeOpacity',color:'hazeColor',enabled:'hazeEnabled'},
  {id:'glow',title:'3 · 紫色光晕',width:'glowWidth',blur:'glowBlur',opacity:'glowOpacity',color:'glowColor',enabled:'glowEnabled'},
  {id:'bridge',title:'4 · 靛蓝过渡',width:'bridgeWidth',blur:'bridgeBlur',opacity:'bridgeOpacity',color:'bridgeColor',enabled:'bridgeEnabled'},
  {id:'transition',title:'5 · 蓝色过渡',width:'transitionWidth',blur:'transitionBlur',opacity:'transitionOpacity',color:'transitionColor',enabled:'transitionEnabled'},
  {id:'mist',title:'6 · 天蓝色带',width:'mistWidth',blur:'mistBlur',opacity:'mistOpacity',color:'mistColor',enabled:'mistEnabled'},
  {id:'soft',title:'7 · 青色流体亮边',width:'softWidth',blur:'softBlur',opacity:'softOpacity',enabled:'softEnabled'},
  {id:'core',title:'8 · 边缘高光',width:'coreWidth',blur:'coreBlur',opacity:'coreOpacity',color:'coreColor',enabled:'coreEnabled'},
];
function UsageWave({settings:s, reducedMotion}:{settings:Settings; reducedMotion:boolean}) {
  const id = useId().replace(/:/g, '');
  const center = s.remaining * 3;
  const amplitude = Math.min(s.amplitude, center, 300-center);
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport,setViewport] = useState({width:300,height:84});
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const {width,height} = svg.getBoundingClientRect();
      if (width > 0 && height > 0) setViewport(current => current.width === width && current.height === height ? current : {width,height});
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  },[]);
  // Compensate for the wave SVG's nonuniform stretch so grid dimensions
  // remain CSS pixels as the content-sized card grows or shrinks.
  const pixelScaleX = 300/viewport.width, pixelScaleY = 84/viewport.height;
  const edgeAt = (phase:number) => {
    const frequency = Math.PI * 2 * s.waves / 84;
    const secondary = s.irregularity * .28;
    const scale = amplitude / (1 + secondary);
    const sample = (y:number) => {
      const angle = y * frequency + phase;
      const drift = y * frequency * .63 + phase * 2 + 1.2;
      return {
        x: center + scale * (Math.sin(angle) + secondary * Math.sin(drift)),
        slope: scale * frequency * (Math.cos(angle) + secondary * .63 * Math.cos(drift)),
      };
    };
    const start = sample(-20);
    let d = `M${start.x} -20`;
    const count = s.waves * 16;
    const step = 124 / count;
    for (let i=0; i<count; i++) {
      const y = -20 + i * step;
      const from = sample(y), to = sample(y + step);
      // Use the same analytic tangent on both sides of every join. This
      // keeps the moving silhouette smooth even at maximum irregularity.
      d += ` C${from.x + from.slope * step / 3} ${y + step / 3} ${to.x - to.slope * step / 3} ${y + step * 2 / 3} ${to.x} ${y + step}`;
    }
    return d;
  };
  const pixelPalette = [s.pixelColor,s.pixelColor2,s.pixelColor3,s.pixelColor4];
  const pixelStep = s.pixelSize+s.pixelGap;
  const pixelCount = Math.ceil(84/pixelStep);
  const pixels = Array.from({length:pixelCount*pixelCount},(_,index) => {
    const noise = Math.abs(Math.sin(index*127.1+31.7)*43758.5453)%1;
    return {index,x:(index%pixelCount)*pixelStep*pixelScaleX,y:Math.floor(index/pixelCount)*pixelStep*pixelScaleY,noise};
  }).filter(pixel => pixel.noise < s.pixelDensity);
  const edge = edgeAt(0);
  const shape = `${edge} H-100 V-20 Z`;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !s.animated || reducedMotion || amplitude === 0) return;
    const edges = svg.querySelectorAll('[data-usage-edge]');
    const fills = svg.querySelectorAll('[data-usage-fill]');
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    const tick = (time:number) => {
      if (document.visibilityState === 'visible') {
        elapsed += previous ? Math.min(time-previous,64) : 0;
        const d = edgeAt(elapsed / (s.duration*1000) * Math.PI*2);
        edges.forEach(path => path.setAttribute('d',d));
        fills.forEach(path => path.setAttribute('d',`${d} H-100 V-20 Z`));
      }
      previous = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [s.remaining,s.amplitude,s.waves,s.irregularity,s.duration,s.animated,reducedMotion,s.auraEnabled,s.hazeEnabled,s.glowEnabled,s.bridgeEnabled,s.transitionEnabled,s.mistEnabled,s.softEnabled,s.coreEnabled,s.pixelsEnabled]);
  return <span className="profile-menu-usage-art" aria-hidden="true"><svg ref={svgRef} className="profile-menu-usage-wave" viewBox="0 0 300 84" preserveAspectRatio="none">
    <defs>
      <pattern id={`${id}-pixels`} width={pixelCount*pixelStep*pixelScaleX} height={pixelCount*pixelStep*pixelScaleY} patternUnits="userSpaceOnUse">
        {pixels.map(pixel => <rect key={pixel.index} className={s.animated && !reducedMotion ? 'usage-pixel is-animated' : 'usage-pixel'} x={pixel.x} y={pixel.y} width={s.pixelSize*pixelScaleX} height={s.pixelSize*pixelScaleY} rx={.5*pixelScaleX} ry={.5*pixelScaleY} fill={s.pixelMulticolor ? pixelPalette[Math.floor((Math.abs(Math.sin(pixel.index*78.233+19.1)*43758.5453)%1)*pixelPalette.length)] : s.pixelColor} style={{opacity:.2+pixel.noise*.6,animationDuration:`${s.pixelDuration*(.7+pixel.noise*.6)}s`,animationDelay:`${-pixel.noise*s.pixelDuration*3}s`}}/>)}
      </pattern>
      <linearGradient id={`${id}-pixel-fade`} gradientUnits="userSpaceOnUse" x1="0" x2={Math.max(1,center)}><stop stopColor="white" stopOpacity={s.remaining === 100 ? .45 : .15}/><stop offset=".6" stopColor="white" stopOpacity={s.remaining === 100 ? .85 : .65}/><stop offset="1" stopColor="white"/></linearGradient>
      <mask id={`${id}-pixel-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="84"><rect width="300" height="84" fill={`url(#${id}-pixel-fade)`}/></mask>
      <clipPath id={`${id}-clip`}><path data-usage-fill d={shape}/></clipPath>
      <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="0" x2={Math.max(1,center+5)} y1="0" y2="0"><stop stopColor={s.fillStart}/><stop offset=".7" stopColor={s.fillMiddle}/><stop offset="1" stopColor={s.fillEdge}/></linearGradient>
      <linearGradient id={`${id}-full-fill`} gradientUnits="userSpaceOnUse" x1="0" x2="300" y1="84" y2="0"><stop stopColor={s.glowColor} stopOpacity=".2"/><stop offset=".6" stopColor={s.bridgeColor} stopOpacity=".15"/><stop offset="1" stopColor={s.mistColor} stopOpacity=".08"/></linearGradient>
      <linearGradient id={`${id}-light`} gradientUnits="userSpaceOnUse" x1={center-15} x2={center+3} y1="5" y2="80"><stop stopColor={s.lightTop}/><stop offset=".44" stopColor={s.lightMiddle}/><stop offset=".68" stopColor={s.lightAccent}/><stop offset="1" stopColor={s.lightBottom}/></linearGradient>
      {layers.map(layer => <filter key={layer.id} id={`${id}-${layer.id}`} filterUnits="userSpaceOnUse" x="-200" y="-200" width="700" height="484"><feGaussianBlur stdDeviation={s[layer.blur]}/></filter>)}
    </defs>
    {s.remaining > 0 && <><path data-usage-fill d={shape} fill={`url(#${id}-fill)`}/>
    {s.remaining === 100 && <path data-usage-fill data-usage-full d={shape} fill={`url(#${id}-full-fill)`}/>}
    {s.remaining < 100 && <g strokeLinejoin="round" strokeLinecap="round" clipPath={s.inward ? `url(#${id}-clip)` : undefined}>
      {layers.map(layer => s[layer.enabled] && <path key={layer.id} data-usage-edge data-usage-layer={layer.id} d={edge} fill="none" stroke={layer.color ? s[layer.color] : `url(#${id}-light)`} strokeWidth={s[layer.width]} opacity={s[layer.opacity]} filter={`url(#${id}-${layer.id})`}/>)}
    </g>}
    {s.pixelsEnabled && <g clipPath={`url(#${id}-clip)`} opacity={s.remaining === 100 ? Math.min(1,s.pixelOpacity*1.5) : s.pixelOpacity}><rect data-usage-pixels width="300" height="84" fill={`url(#${id}-pixels)`} mask={`url(#${id}-pixel-mask)`}/></g>}
    </>}
  </svg></span>;
}

export default function UsageCard({onRemainingChange}:{onRemainingChange?:(remaining:number)=>void}) {
  const s = defaults;
  useLayoutEffect(() => { onRemainingChange?.(s.remaining); },[s.remaining,onRemainingChange]);
  const [reducedMotion,setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener('change',sync);
    return () => query.removeEventListener('change',sync);
  },[]);
  const rgba = (hex:string,opacity:number) => `rgba(${[1,3,5].map(offset => parseInt(hex.slice(offset,offset+2),16)).join(',')},${opacity})`;
  const style = {padding:`8px ${s.padding}px`,background:s.remaining === 0 ? 'var(--usage-empty-fill)' : rgba(s.cardFillColor,s.cardFillOpacity),'--usage-card-border-width':`${s.cardBorderWidth}px`,'--usage-card-border-color':rgba(s.cardBorderColor,s.cardBorderOpacity)} as CSSProperties;
  return <button type="button" className="profile-menu-usage-button" data-mode={s.remaining > 0 ? 'dark' : undefined} data-empty={s.remaining === 0} style={style} aria-label={`本周剩余用量 ${s.remaining}%，17 小时 23 分钟后重置`}>
      <UsageWave settings={s} reducedMotion={reducedMotion}/>
      <span className="profile-menu-usage-copy"><span style={{fontSize:s.titleSize}}>本周剩余用量</span><small>17 小时 23 分钟后重置</small></span>
      <strong className="profile-menu-usage-value">{s.remaining}<span>%</span></strong>
      <span className="profile-menu-usage-meter" role="meter" aria-label="本周剩余用量" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.remaining}/>
    </button>;
}
