import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePageSwipe } from './personalized-home-2-0/usePageSwipe';
import { publishSpaceGesture } from './spaceTransition';
import SpaceIcon, { type SpaceAppearance } from './SpaceIcon';

type Preview = { from:number; to:number; progress:number };
type Props = { renderPreview:(spaceId:number)=>ReactNode; children:ReactNode; spaces:SpaceAppearance[]; spaceId:number; spaceIds:number[]; onSelect:(id:number)=>void; collapsed:boolean };
export default function VerticalSpaceSwipe({ renderPreview, children, spaces, spaceId, spaceIds, onSelect, collapsed }:Props) {
  const root = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const [settling, setSettling] = useState<'commit' | 'cancel' | 'handoff' | null>(null);
  const [settleDuration, setSettleDuration] = useState(220);
  const settleTimer = useRef(0);
  const currentIds = useRef(spaceIds);
  currentIds.current = spaceIds;
  const lastSpace = useRef(spaceId);
  const direction = useRef(1);
  const gestureCommitted = useRef(false);
  const entryAnimation = useRef<Animation | null>(null);
  const index = spaceIds.indexOf(spaceId);
  if (lastSpace.current !== spaceId) {
    direction.current = Math.sign(index - spaceIds.indexOf(lastSpace.current)) || 1;
    lastSpace.current = spaceId;
  }
  useLayoutEffect(() => {
    const node = root.current!;
    const progress = (event:Event) => {
      const next = (event as CustomEvent<Preview | null>).detail;
      window.clearTimeout(settleTimer.current);
      if (next) {
        entryAnimation.current?.cancel();
        previewRef.current = next;
        setSettling(null);
        setPreview(next);
      } else if (previewRef.current) {
        const current = previewRef.current;
        const duration = Math.round(150 + 100 * current.progress);
        setSettleDuration(duration);
        setSettling('cancel');
        settleTimer.current = window.setTimeout(() => {
          previewRef.current = null;
          setPreview(null);
          setSettling(null);
        }, duration);
      }
      publishSpaceGesture(next ? {fromSpaceId:String(currentIds.current[next.from]),toSpaceId:String(currentIds.current[next.to]),progress:next.progress} : null);
    };
    node.addEventListener('page-swipe-progress', progress);
    return () => node.removeEventListener('page-swipe-progress', progress);
  }, []);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);
  useLayoutEffect(() => {
    if (gestureCommitted.current) {
      gestureCommitted.current = false;
      const frame = requestAnimationFrame(() => setSettling(null));
      return () => cancelAnimationFrame(frame);
    }
    const region = root.current?.querySelector('.vertical-space-sidebar-layer:not([hidden]) .vertical-tabs-region');
    if (!region || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    entryAnimation.current = region.animate([{transform:`translateX(${direction.current * 48}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],{duration:400,easing:'cubic-bezier(.2,0,0,1)'});
    return () => entryAnimation.current?.cancel();
  }, [spaceId]);
  usePageSwipe(root, {
    blocked:collapsed,
    pages:spaceIds.map(id => ({name:spaces[id].name})), index,
    swipeWidth:'root',
    onSelect:next => {
      const current = previewRef.current;
      if (!current) { onSelect(spaceIds[next]); return; }
      const duration = Math.round(150 + 100 * (1 - current.progress));
      window.clearTimeout(settleTimer.current);
      setSettleDuration(duration);
      setSettling('commit');
      publishSpaceGesture({fromSpaceId:String(spaceId),toSpaceId:String(spaceIds[next]),progress:1});
      settleTimer.current = window.setTimeout(() => {
        gestureCommitted.current = true;
        previewRef.current = null;
        setPreview(null);
        setSettling('handoff');
        onSelect(spaceIds[next]);
      }, duration);
    },
  });
  const animatedProgress = preview ? settling === 'commit' ? 1 : settling === 'cancel' ? 0 : preview.progress : 0;
  const previewDirection = preview ? Math.sign(preview.to-preview.from) : 1;
  const directManipulation = Boolean(preview && !settling) || settling === 'handoff';
  return <div ref={root} className={`vertical-sidebar-slot ${directManipulation ? 'is-space-gesturing' : ''}`} data-tauri-drag-region style={{ '--space-swipe-direction':direction.current, '--space-settle-duration':`${settleDuration}ms`, '--space-drag-offset':`${preview ? -previewDirection*animatedProgress*100 : 0}%`, '--space-drag-opacity':preview ? 1-animatedProgress*.6 : 1 } as CSSProperties}>
    {children}
    {preview && <div className="vertical-space-preview" inert aria-hidden="true" style={{transform:`translateX(${previewDirection*(1-animatedProgress)*100}%)`,opacity:animatedProgress}}>{renderPreview(spaceIds[preview.to])}</div>}
    <div className={`vertical-sidebar-footer ${directManipulation ? 'is-space-gesturing' : ''}`} inert={collapsed} aria-hidden={collapsed || undefined} data-tauri-drag-region>
      <div className="space-switcher" data-tauri-drag-region>{spaceIds.map((id, slot) => {
        const weight = preview ? slot === preview.from ? 1 - animatedProgress : slot === preview.to ? animatedProgress : 0 : slot === index ? 1 : 0;
        const tipId = `${tooltipId}-${id}`;
        return <button key={id} aria-label={`切换到${spaces[id].name}`} aria-describedby={tipId} aria-current={id === spaceId ? 'page' : undefined} onClick={() => { window.clearTimeout(settleTimer.current); publishSpaceGesture(null); previewRef.current=null; setPreview(null); setSettling(null); onSelect(id); }}>
          <span className="space-indicator-image" style={{opacity:weight,transform:`scale(${.45 + .55 * weight})`}}><SpaceIcon space={spaces[id]}/></span>
          <i style={{opacity:1-weight,transform:`scale(${1 - .5 * weight})`}}/>
          <span id={tipId} role="tooltip" className="space-indicator-tooltip">
            <span>{spaces[id].name}</span>
            {slot < 9 && <span className="space-tooltip-keys"><kbd>⌥</kbd><kbd>{slot + 1}</kbd></span>}
          </span>
        </button>;
      })}</div>
    </div>
  </div>;
}
