import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Ellipsis, FilePlus2, Folder, Globe, Layers, Search, Star, X } from "./icons";
import './composer-add-menu.css';

// Prototype reference entries; this page does not read the browser's real tabs or bookmarks.
const TABS = [
  { id: 'tab-dailymotion', title: 'Dailymotion', url: 'https://www.dailymotion.com/', mark: 'd' },
  { id: 'tab-eye-exercises', title: '旧版眼保健操欣赏！（附原声）', url: 'https://www.bilibili.com/' },
  { id: 'tab-x', title: 'X - 包罗万象的应用 / X', url: 'https://x.com/' },
  { id: 'tab-dler', title: 'dler.pro', url: 'https://dler.pro/' },
  { id: 'tab-github', title: 'GitHub', url: 'https://github.com/' },
  { id: 'tab-juejin', title: '稀土掘金', url: 'https://juejin.cn/' },
  { id: 'tab-figma', title: 'Figma', url: 'https://www.figma.com/' },
  { id: 'tab-notion', title: 'Notion', url: 'https://www.notion.so/' },
  { id: 'tab-youtube', title: 'YouTube', url: 'https://www.youtube.com/' },
].map(tab => ({ ...tab, kind: 'tab' }));

const BOOKMARKS = [
  { id: 'bookmark-github', title: 'GitHub', url: 'https://github.com/' },
  { id: 'bookmark-juejin', title: '稀土掘金', url: 'https://juejin.cn/' },
  { id: 'bookmark-dribbble', title: 'Dribbble', url: 'https://dribbble.com/' },
  { id: 'bookmark-notion', title: 'Notion', url: 'https://www.notion.so/' },
].map(bookmark => ({ ...bookmark, kind: 'bookmark' }));

function ReferenceRow({ item, onSelect }) {
  const type = item.kind === 'bookmark' ? '收藏' : '标签';
  return <button type="button" className="tb-composer-menu-row tb-context-reference" data-composer-menu-item aria-label={`引用${type}：${item.title}`} title={item.title} onClick={() => onSelect([item])}>
    {item.mark ? <span className="tb-context-site-mark" aria-hidden="true">{item.mark}</span> : <Globe size={16} aria-hidden="true" />}
    <span className="tb-context-reference-title">{item.title}</span>
    <small>– {type}</small>
  </button>;
}

export default function ComposerAddMenu({ onReferences, onFiles, onFolder, active = true }) {
  const [view, setView] = useState('main');
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const search = query.trim().toLocaleLowerCase();
  const matches = item => `${item.title} ${item.url}`.toLocaleLowerCase().includes(search);
  const tabs = TABS.filter(matches);
  const bookmarks = BOOKMARKS.filter(matches);

  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [view, active]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [view, query]);

  function changeView(next) {
    setQuery('');
    setView(next);
  }

  function selectReferences(items) {
    onReferences(items.map(({ id, title, url, kind }) => ({ id, title, url, kind })));
  }

  function keydown(event) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape' && view !== 'main') {
      event.preventDefault();
      event.stopPropagation();
      changeView('main');
      return;
    }
    const items = [...rootRef.current.querySelectorAll('[data-composer-menu-item]')];
    const current = items.indexOf(document.activeElement);
    const isInput = event.target === inputRef.current;
    if ((isInput && !['ArrowDown', 'ArrowUp'].includes(event.key)) || (!isInput && current < 0)) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!items.length) return;
    const next = event.key === 'Home' || (isInput && event.key === 'ArrowDown') ? 0
      : event.key === 'End' || (isInput && event.key === 'ArrowUp') ? items.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    items[next]?.focus();
  }

  const showTabs = view !== 'bookmarks';
  const showBookmarks = view === 'bookmarks' || (view === 'main' && search);
  const visibleTabs = view === 'main' && !search ? tabs.slice(0, 4) : tabs;
  const empty = (!showTabs || !tabs.length) && (!showBookmarks || !bookmarks.length);

  return <div className="tb-context-menu-content" data-view={view} ref={rootRef} onKeyDown={keydown}>
    <div className="tb-context-browser">
    {view !== 'main' && <button type="button" className="tb-composer-menu-row tb-context-back" data-composer-menu-item aria-label="返回添加菜单" onClick={() => changeView('main')}><ChevronLeft size={16} aria-hidden="true" /><span>{view === 'tabs' ? '所有标签页' : '收藏'}</span></button>}
    <div className="tb-dropdown-search">
      <Search size={16} aria-hidden="true" />
      <input ref={inputRef} data-composer-initial type="search" aria-label={view === 'bookmarks' ? '搜索收藏' : view === 'tabs' ? '搜索标签页' : '搜索标签页或收藏'} placeholder="搜索…" value={query} onChange={event => setQuery(event.target.value)} />
      {query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); inputRef.current?.focus(); }}><X size={14} aria-hidden="true" /></button>}
    </div>
    <div ref={listRef} className="tb-context-list">
      {showTabs && <div className="tb-context-group">
        {!search && <button type="button" className="tb-composer-menu-row" data-composer-menu-item onClick={() => selectReferences(TABS)}><Layers size={16} aria-hidden="true" /><span>所有已打开标签页（{TABS.length}）</span></button>}
        {search && tabs.length > 0 && <div className="tb-composer-menu-heading">标签页</div>}
        {visibleTabs.map(item => <ReferenceRow key={item.id} item={item} onSelect={selectReferences} />)}
        {view === 'main' && !search && <button type="button" className="tb-composer-menu-row" data-composer-menu-item onClick={() => changeView('tabs')}><Ellipsis size={16} aria-hidden="true" /><span>查看全部</span><ChevronRight size={15} aria-hidden="true" /></button>}
      </div>}
      {showBookmarks && <div className="tb-context-group">
        {view === 'main' && bookmarks.length > 0 && <div className="tb-composer-menu-heading">收藏</div>}
        {bookmarks.map(item => <ReferenceRow key={item.id} item={item} onSelect={selectReferences} />)}
      </div>}
      {empty && <p className="tb-context-empty" role="status">没有找到相关{view === 'bookmarks' ? '收藏' : view === 'tabs' ? '标签页' : '内容'}</p>}
    </div>
    </div>
    {view === 'main' && <footer className="tb-dropdown-footer">
      <div className="tb-context-actions-title">添加到对话</div>
      <p className="tb-context-actions-copy">从电脑添加图片、文档或文件夹，也可以引用收藏。</p>
      {!search && <button type="button" className="tb-composer-menu-row" data-composer-menu-item onClick={() => changeView('bookmarks')}><Star size={16} aria-hidden="true" /><span>收藏</span><ChevronRight size={15} aria-hidden="true" /></button>}
      <button type="button" className="tb-composer-menu-row" data-composer-menu-item onClick={onFiles}><FilePlus2 size={16} aria-hidden="true" /><span>上传本地文件</span></button>
      <button type="button" className="tb-composer-menu-row" data-composer-menu-item onClick={onFolder}><Folder size={16} aria-hidden="true" /><span>选择本地文件夹</span></button>
    </footer>}
  </div>;
}
