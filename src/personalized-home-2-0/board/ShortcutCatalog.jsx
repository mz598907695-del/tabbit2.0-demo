import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Plus } from "../icons";
import { ShortcutIconTile } from './ShortcutIcon';
import { shortcutCatalog } from './shortcut-catalog';
import { loadFrequentSites, toFrequentShortcuts } from './frequent-sites';
import FadeText from './FadeText';
import './shortcut-catalog.css';

const CATEGORY_NAMES = {
  'Search & AI': '搜索与 AI',
  'Social & Messaging': '社交与社区',
  'Video, Music & Games': '视频与音乐',
  'Mail, Work & Cloud': '邮箱、办公与网盘',
  'Shopping & Travel': '购物与消费',
  'News & Information': '新闻与财经',
  'Learning & Reference': '学习与阅读',
  'Development & Design': '开发与设计',
};
const TRAVEL_SITES = new Set(['Booking.com', 'Airbnb', 'Google Maps']);
const seenUrls = new Set();
const unifiedCatalog = shortcutCatalog.filter(item => {
  if (seenUrls.has(item.url)) return false;
  seenUrls.add(item.url);
  return true;
}).map(item => ({ ...item, section: TRAVEL_SITES.has(item.label) ? '生活与出行' : CATEGORY_NAMES[item.category] || item.category }));
const categories = [...new Set(unifiedCatalog.map(item => item.section))];
const navigation = ['全部', ...categories];

export default function ShortcutCatalog({ customForm, onAdd, disabled, targetId, query = '', scrollContainerRef, active = true, shortcutShape = 'circle', shortcutSize = 'small', appearanceTheme = 'light' }) {
  const id = useId();
  const [category, setCategory] = useState('全部');
  const [added, setAdded] = useState({});
  const [error, setError] = useState('');
  const [frequentSites, setFrequentSites] = useState([]);
  const [frequentState, setFrequentState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const timers = useRef({});
  const navigationRef = useRef(null);
  const buttonRefs = useRef({});
  const sectionRefs = useRef({});
  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matches = unifiedCatalog.filter(item => `${item.label} ${item.url} ${item.category} ${item.section}`.toLowerCase().includes(search));
    return categories.map(name => ({ name, items: matches.filter(item => item.section === name) })).filter(group => group.items.length);
  }, [query]);
  const frequentMatches = useMemo(() => frequentSites.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())), [frequentSites, query]);
  const availableCategories = ['全部', ...groups.map(group => group.name)];
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setFrequentState('loading');
    loadFrequentSites(controller.signal).then(sites => {
      if (controller.signal.aborted) return;
      const items = toFrequentShortcuts(sites, unifiedCatalog);
      setFrequentSites(items);
      setFrequentState(items.length ? 'ready' : 'empty');
    }).catch(() => {
      if (!controller.signal.aborted) { setFrequentSites([]); setFrequentState('unavailable'); }
    });
    return () => controller.abort();
  }, [active, retry]);
  useEffect(() => { setAdded({}); setError(''); }, [targetId]);
  useEffect(() => {
    setCategory('全部');
    if (active) {
      scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'instant' });
      navigationRef.current?.scrollTo({ left: 0, behavior: 'instant' });
    }
  }, [query, active, scrollContainerRef]);

  function goToCategory(name) {
    setCategory(name);
    const scroller = scrollContainerRef?.current;
    const nav = navigationRef.current;
    const target = sectionRefs.current[name];
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    if (scroller && nav) {
      const glassTail = parseFloat(window.getComputedStyle(nav.parentElement).marginBottom) || 20;
      const top = name === '全部' || !target ? 0 : scroller.scrollTop + target.getBoundingClientRect().top - nav.getBoundingClientRect().bottom - glassTail;
      scroller.scrollTo({ top: Math.max(0, top), behavior });
    }
    const button = buttonRefs.current[name];
    if (nav && button) {
      const buttonLeft = button.offsetLeft;
      const buttonRight = buttonLeft + button.offsetWidth;
      if (buttonLeft < nav.scrollLeft) nav.scrollTo({ left: buttonLeft, behavior });
      else if (buttonRight > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: buttonRight - nav.clientWidth, behavior });
    }
  }

  function handleNavigationKey(event, name) {
    const index = availableCategories.indexOf(name);
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = availableCategories.length - 1;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % availableCategories.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + availableCategories.length) % availableCategories.length;
    else return;
    event.preventDefault();
    const next = availableCategories[nextIndex];
    buttonRefs.current[next]?.focus({ preventScroll: true });
    goToCategory(next);
  }

  function add(item) {
    if (disabled) return;
    const result = onAdd({ label: item.label, url: item.url, image: item.image });
    if (!result?.ok) { setError(result?.message || '添加失败，请重试'); return; }
    setError('');
    setAdded(current => ({ ...current, [item.id]: targetId }));
    clearTimeout(timers.current[item.id]);
    timers.current[item.id] = setTimeout(() => setAdded(current => ({ ...current, [item.id]: null })), 1400);
  }
  function renderCard(item) {
    return <article key={item.id} className="shortcut-catalog-card" data-catalog-id={item.id}>
        <ShortcutIconTile item={item} shape={shortcutShape} iconSize={shortcutSize} appearanceTheme={appearanceTheme} aria-hidden="true" />
        <div className="shortcut-catalog-copy"><h3 title={item.label}>{item.label}</h3><FadeText>{item.description || new URL(item.url).hostname.replace(/^www\./, '')}</FadeText></div>
        <button type="button" className="shortcut-catalog-add" aria-label={`添加${item.label}`} disabled={disabled} onClick={() => add(item)}>{added[item.id] === targetId ? <Check size={16} /> : <Plus size={17} />}</button>
      </article>;
  }
  const headingId = name => `${id}-category-${categories.indexOf(name)}`;
  const sectionTitle = name => <h3 className="shortcut-catalog-section-title" id={headingId(name)}>{name}</h3>;

  return <div className="shortcut-catalog">
    <div className="shortcut-catalog-chrome">
    <div className="shortcut-catalog-glass" aria-hidden="true"><span /><span /><span /></div>
    <nav className="shortcut-catalog-navigation" ref={navigationRef} aria-label="网站分类">
      {navigation.map(name => <button
        key={name}
        ref={node => { buttonRefs.current[name] = node; }}
        type="button"
        aria-pressed={category === name}
        aria-controls={name === '全部' ? `${id}-sections` : headingId(name)}
        tabIndex={category === name ? 0 : -1}
        disabled={!availableCategories.includes(name)}
        onClick={() => goToCategory(name)}
        onKeyDown={event => handleNavigationKey(event, name)}
      >{name}</button>)}
    </nav>
    </div>
    <div className="shortcut-catalog-sections" id={`${id}-sections`}>
      <section className="shortcut-catalog-section shortcut-catalog-frequent" aria-labelledby={`${id}-frequent-heading`}>
        <h3 className="shortcut-catalog-section-title" id={`${id}-frequent-heading`}>经常访问的网站</h3>
        <div className="shortcut-catalog-grid">
          <section className="board-library-shortcut-card shortcut-catalog-custom"><h3>自定义添加</h3>{customForm}</section>
          {frequentState === 'ready' && frequentMatches.map(renderCard)}
          {(frequentState !== 'ready' || !frequentMatches.length) && <div className="shortcut-catalog-empty shortcut-catalog-frequent-status" role="status">
            <span>{frequentState === 'loading' ? '正在加载经常访问的网站…' : frequentState === 'unavailable' ? '暂时无法读取 Tabbit 的访问记录' : frequentState === 'empty' ? '暂无经常访问的网站' : '没有找到相关网站'}</span>
            {frequentState === 'unavailable' && <button type="button" onClick={() => setRetry(value => value + 1)}>重新加载</button>}
          </div>}
        </div>
      </section>
      {groups.map(group => <section className="shortcut-catalog-section" key={group.name} ref={node => { sectionRefs.current[group.name] = node; }} aria-labelledby={headingId(group.name)}>
        {sectionTitle(group.name)}
        <div className="shortcut-catalog-grid">{group.items.map(renderCard)}</div>
      </section>)}
    </div>
    {error && <p className="board-dialog-error" role="alert">{error}</p>}
  </div>;
}
