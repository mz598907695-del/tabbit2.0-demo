import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '../icons';
import './workspace-files.css';

const imageHues = { '1':'blue', '2':'blue', '3':'blue', '4':'red', '5':'yellow', '6':'orange', '7':'green', '8':'orange', '9':'cyan', '10':'blue', '11':'orange', '12':'green', '13':'purple', '14':'purple' };

export default function OfficialSkills({ section, onOpen }) {
  const railRef = useRef(null);
  const [edges, setEdges] = useState({ left:false, right:false });
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    const rail = railRef.current;
    let stopTimer;
    function stop() { clearTimeout(stopTimer); setScrolling(false); }
    function scroll() {
      measure();
      setScrolling(true);
      clearTimeout(stopTimer);
      stopTimer = setTimeout(stop, 140);
    }
    function measure() {
      setEdges({ left:rail.scrollLeft > 1, right:rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 1 });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    rail.addEventListener('scroll', scroll, { passive:true });
    rail.addEventListener('scrollend', stop);
    window.addEventListener('resize', measure);
    measure();
    return () => { clearTimeout(stopTimer); observer.disconnect(); rail.removeEventListener('scroll', scroll); rail.removeEventListener('scrollend', stop); window.removeEventListener('resize', measure); };
  }, [section.items]);
  function move(direction) {
    const rail = railRef.current;
    rail.scrollBy({ left:direction * rail.clientWidth, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <section id={`aiws-section-${section.id}`} data-skill-section={section.id} className="aiws-section aiws-official" aria-label={section.label}>
    <div className="aiws-section-heading"><div className="aiws-official-heading"><h2>{section.label}</h2><span>自动更新</span></div><div className="aiws-official-arrows">
      <button aria-label="向左浏览官方预装" disabled={!edges.left} onClick={() => move(-1)}><ChevronLeft size={14}/></button>
      <button aria-label="向右浏览官方预装" disabled={!edges.right} onClick={() => move(1)}><ChevronRight size={14}/></button>
    </div></div>
    <div className="aiws-official-rail" ref={railRef} data-left={scrolling && edges.left} data-right={scrolling && edges.right}>
      {section.items.map(item => { const hue = imageHues[item.officialIcon] || 'blue'; return <article className="aiwf-card aiws-official-card" key={item.id}>
        <button className="aiwf-card-open" aria-label={`查看 ${item.title}详情`} onClick={() => onOpen(item)}>
          <span className="aiws-official-icon" style={{ '--official-icon-fill':`var(--color-${hue}-4)` }}><img src={`/personalized-home-2-0/asset/official-skills/${item.officialIcon}.png?v=3`} alt="" width="40" height="40"/></span>
          <span className="aiws-official-copy"><span className="aiwf-card-title" title={item.title}>{item.title}</span><span className="aiwf-card-description" title={item.description}>{item.description}</span></span>
        </button>
      </article>; })}
    </div>
  </section>;
}
