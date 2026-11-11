import { useRef, useState } from 'react';
import { Controls, Grid2X2, MessageCircleQuestion, Search, Sparkles, X } from './icons';
import './composer-ideas.css';

export const IDEAS = [
  { id:'polish', name:'润色', Icon:Sparkles, tone:'purple', prompt:'请润色以下内容，保持原意不变，让表达更清楚、自然、有重点。\n\n需要润色的内容：' },
  { id:'summary', name:'总结', Icon:Grid2X2, tone:'green', prompt:'请总结以下内容，提炼核心信息、关键结论与需要继续关注的事项。\n\n需要总结的内容：' },
  { id:'explain', name:'解释', Icon:MessageCircleQuestion, tone:'amber', prompt:'请解释以下内容，用清楚易懂的语言说明关键概念、逻辑和必要背景。\n\n需要解释的内容：' },
];

export default function ComposerIdeasMenu({ onSelect, onManage }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const bodyRef = useRef(null);
  const listRef = useRef(null);
  const keyword = query.trim().toLocaleLowerCase();
  const visibleIdeas = IDEAS.filter(idea => idea.name.toLocaleLowerCase().includes(keyword));

  function changeQuery(value) {
    setQuery(value);
    if (listRef.current) listRef.current.scrollTop = 0;
  }

  function keydown(event) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      event.stopPropagation();
      changeQuery('');
      searchRef.current?.focus({ preventScroll:true });
      return;
    }
    const inSearch = event.target === searchRef.current;
    const controls = [...bodyRef.current.querySelectorAll('[data-composer-menu-item]:not(:disabled)')];
    const index = controls.indexOf(event.target);
    if (!inSearch && index < 0) return;
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) && (inSearch || !['Home', 'End'].includes(event.key))) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
    const target = next < 0 ? searchRef.current : controls[Math.min(next, controls.length - 1)];
    target?.focus({ preventScroll:true });
  }

  return <div ref={bodyRef} className="tb-ideas-body" onKeyDown={keydown}>
    <div className="tb-dropdown-search-slot">
      <div className="tb-dropdown-search">
        <Search size={16} aria-hidden="true"/>
        <input ref={searchRef} data-composer-initial="" aria-label="搜索妙招" placeholder="搜索妙招" value={query} autoComplete="off" onChange={event => changeQuery(event.target.value)}/>
        {query && <button type="button" aria-label="清除妙招搜索" onClick={() => { changeQuery(''); searchRef.current?.focus({ preventScroll:true }); }}><X size={14} aria-hidden="true"/></button>}
      </div>
    </div>
    <div ref={listRef} className="tb-ideas-list" role="group" aria-label="妙招列表">
      {visibleIdeas.map(({ id, name, Icon, tone, prompt }) => <button key={id} type="button" className="tb-composer-menu-row tb-idea-row" data-composer-menu-item="" onClick={() => onSelect(prompt)}>
        <span className="tb-idea-icon" data-tone={tone}><Icon size={16} aria-hidden="true"/></span>
        <span className="tb-idea-copy"><strong>{name}</strong></span>
      </button>)}
      {!visibleIdeas.length && <div className="tb-ideas-empty" role="status"><Search size={23} aria-hidden="true"/><strong>没有找到相关妙招</strong></div>}
    </div>
    <footer className="tb-ideas-footer tb-dropdown-footer">
      <button type="button" className="tb-composer-menu-row" data-composer-menu-item="" onClick={onManage}><Controls size={16} aria-hidden="true"/><span>创建或管理妙招</span></button>
    </footer>
  </div>;
}
