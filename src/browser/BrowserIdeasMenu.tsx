import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot, Box, ChartCandlestick, ClipboardList, Ellipsis, FileImage,
  Globe, Lightbulb, Microscope, PackageOpen, Plus, Presentation, ShoppingBag, Sparkles,
  Store, WandSparkles,
} from 'lucide-react';
import '../styles/dropdown.css';
import './browser-ideas-menu.css';

type MenuIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;
type Idea = { name:string; Icon:MenuIcon; tone:string; kind?:'script' | 'agent' };

const ideas: Idea[] = [
  { name:'总结', Icon:ClipboardList, tone:'green' },
  { name:'润色', Icon:WandSparkles, tone:'purple' },
  { name:'解释', Icon:Sparkles, tone:'orange' },
  { name:'脚本盲盒', Icon:Box, tone:'orange', kind:'script' },
  { name:'双十一我想买', Icon:ShoppingBag, tone:'brown', kind:'agent' },
  { name:'AI 卡片生成', Icon:Lightbulb, tone:'rose', kind:'agent' },
  { name:'Tabbit 省钱助手', Icon:Store, tone:'amber', kind:'agent' },
  { name:'美团生活助手', Icon:Lightbulb, tone:'rose', kind:'agent' },
  { name:'生成图片', Icon:FileImage, tone:'amber', kind:'agent' },
  { name:'金融市场分析', Icon:ChartCandlestick, tone:'brown', kind:'agent' },
  { name:'深度研究', Icon:Microscope, tone:'blue', kind:'agent' },
  { name:'生成网页', Icon:Globe, tone:'green', kind:'agent' },
  { name:'生成 PPT', Icon:Presentation, tone:'amber', kind:'agent' },
];

export default function BrowserIdeasMenu({ anchor, onClose }:{ anchor:HTMLElement; onClose:()=>void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left:12, top:48, maxHeight:640 });

  useLayoutEffect(() => {
    const place = () => {
      const bounds = anchor.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 24);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, bounds.right - width));
      const top = Math.max(12, bounds.bottom + 8);
      setPosition({ left, top, maxHeight:Math.max(180, Math.min(400, window.innerHeight - top - 12)) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const pointerDown = (event:PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node) || anchor.contains(event.target as Node)) return;
      onClose();
    };
    const keyDown = (event:KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      anchor.focus({ preventScroll:true });
    };
    document.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('keydown', keyDown, true);
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('keydown', keyDown, true);
    };
  }, [anchor, onClose]);

  const openSkills = (filter:'custom' | 'official') => {
    onClose();
    window.dispatchEvent(new CustomEvent('tabbit-open-ai-workspace', { detail:{ page:'skills', filter } }));
  };

  return createPortal(<div ref={panelRef} className="browser-ideas-menu dropdown-surface" role="dialog" aria-label="妙招"
    style={{ left:position.left, top:position.top, width:Math.min(280, window.innerWidth - 24), maxHeight:position.maxHeight }}>
    <header className="browser-ideas-header">
      <h2>妙招</h2>
      <button type="button" onClick={() => openSkills('custom')}><Plus size={14}/><span>创建及管理妙招</span></button>
    </header>
    <div className="browser-ideas-list">
      {ideas.map(({ name, Icon, tone, kind }) => <div className="browser-idea-row" key={name}>
        <button type="button" className="browser-idea-main" onClick={onClose}>
          <span className="browser-idea-icon" data-tone={tone}><Icon size={16}/></span>
          <span>{name}</span>
          {kind === 'script' && <PackageOpen className="browser-idea-kind" size={13}/ >}
          {kind === 'agent' && <Bot className="browser-idea-kind" size={13}/ >}
        </button>
        <button type="button" className="browser-idea-more" aria-label={`${name}的更多操作`}><Ellipsis size={14}/></button>
      </div>)}
    </div>
    <footer className="browser-ideas-footer"><button type="button" onClick={() => openSkills('official')}><Store size={16}/><span>妙招广场</span></button></footer>
  </div>, document.body);
}
