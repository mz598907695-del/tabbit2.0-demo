import { getCurrentWindow } from '@tauri-apps/api/window';
import { useContext, useEffect, useRef, useState } from 'react';
import { tabAddressFor } from '../tabAddresses';
import profileAvatar from '../assets/profile-avatar.webp';
import { SpaceContext } from './SpaceContext';
import { IconFont, SiteFavicon } from './BrowserIcons';
import BrowserIdeasMenu from './BrowserIdeasMenu';
import BrowserMoreMenu from './BrowserMoreMenu';
import ProfileMenu from './ProfileMenu';

const bookmarks: { label: string; folder?: boolean; site?: string }[] = [
  { label: "美团", folder: true }, { label: "个人收藏", folder: true },
  { label: "Notion", site: "notion" }, { label: "yang", site: "yang" },
  { label: "purposetalent", site: "purposetalent" }, { label: "trickle", site: "trickle" },
  { label: "Grok", site: "grok" }, { label: "Claude", site: "claude" },
];
export default function WindowToolbar({ isNewTab, tabId, leading, showBookmarks = true }: { isNewTab: boolean; tabId: string; leading?:React.ReactNode; showBookmarks?:boolean }) {
  const { selectedSpace } = useContext(SpaceContext);
  const addressKey = `${selectedSpace}:${tabId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const ideasButtonRef = useRef<HTMLButtonElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);

  const addressDrag = useRef<{x:number; y:number} | null>(null);
  const addressWasDragged = useRef(false);
  useEffect(() => {
    const move = (event:PointerEvent) => {
      const start = addressDrag.current;
      if (!start || !(event.buttons & 1)) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) return;
      addressDrag.current = null;
      addressWasDragged.current = true;
      getCurrentWindow().startDragging().catch(error => console.warn("Address bar window drag failed", error));
    };
    const end = () => { addressDrag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); window.removeEventListener("blur", end); };
  }, []);

  const [addresses, setAddresses] = useState<Record<string, string>>({});
  return <>
    <div className="address-row" data-tauri-drag-region>
      {leading}
      <div className="nav-actions address-actions-left" data-tauri-drag-region>
        <button aria-label="后退" disabled><IconFont name="nav-back"/></button><button aria-label="前进" disabled><IconFont name="nav-forward"/></button><button aria-label="刷新" disabled={isNewTab}><IconFont name="nav-refresh"/></button>
      </div>
      <div className="address-field" onPointerDown={event => {
        addressWasDragged.current = false;
        if (event.button !== 0 || !("__TAURI_INTERNALS__" in window) || (event.target as HTMLElement).closest("button") || document.activeElement === inputRef.current) return;
        event.preventDefault();
        addressDrag.current = {x:event.clientX, y:event.clientY};
      }} onClick={event => {
        if (addressWasDragged.current) { addressWasDragged.current = false; return; }
        if (!(event.target as HTMLElement).closest("button")) inputRef.current?.focus();
      }}>
        <input ref={inputRef} className="address-input" aria-label="地址栏" placeholder="搜索或输入网址" value={addresses[addressKey] ?? tabAddressFor(tabId)} onChange={(event) => setAddresses((current) => ({ ...current, [addressKey]: event.target.value }))} spellCheck={false} autoComplete="off"/>
        <div className="address-field-actions">
          <button type="button" aria-label="收藏当前页面"><IconFont name="xingxing"/></button>
          <button type="button" aria-label="语言"><IconFont name="yuyan_zhongwen_yingwen"/></button>
        </div>
      </div>
      <div className="toolbar-actions address-actions-right" data-tauri-drag-region>
        <div className="toolbar-primary" data-tauri-drag-region>
          <button className="toolbar-icon-button" aria-label="应用"><IconFont name="xingzhuang_zhengfangxing_sanjiaoxing_yua"/></button>
          <button ref={profileButtonRef} className="toolbar-icon-button" aria-label="个人资料" aria-haspopup="dialog" aria-expanded={profileOpen} onClick={() => { setMoreOpen(false); setIdeasOpen(false); setProfileOpen(open => !open); }}><img className="toolbar-avatar" src={profileAvatar} alt="" draggable={false}/></button>
          <button ref={moreButtonRef} className="toolbar-icon-button" aria-label="更多" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => { setProfileOpen(false); setIdeasOpen(false); setMoreOpen(open => !open); }}><IconFont name="dian_shenglvehao"/></button>
        </div>
        <button ref={ideasButtonRef} className="toolbar-icon-button" aria-label="妙招" aria-haspopup="dialog" aria-expanded={ideasOpen} onClick={() => { setProfileOpen(false); setMoreOpen(false); setIdeasOpen(open => !open); }}><IconFont name="dengpao_xiangfa"/></button>
        <button className="chat-button"><span className="chat-button-icon" aria-hidden="true"/><span>Chat</span></button>
      </div>
      {profileOpen && profileButtonRef.current && <ProfileMenu anchor={profileButtonRef.current} onClose={() => setProfileOpen(false)}/>}
      {moreOpen && moreButtonRef.current && <BrowserMoreMenu anchor={moreButtonRef.current} onClose={() => setMoreOpen(false)}/>}
      {ideasOpen && ideasButtonRef.current && <BrowserIdeasMenu anchor={ideasButtonRef.current} onClose={() => setIdeasOpen(false)}/>}
    </div>
    {showBookmarks && <BookmarksRow/>}
  </>;
}

export function BookmarksRow() { return (
    <div className="bookmarks-row" data-tauri-drag-region>
      {bookmarks.map((bookmark) => <button type="button" className="bookmark" key={bookmark.label}>
        {bookmark.folder ? <IconFont name="wenjianjia_3"/> : <SiteFavicon site={bookmark.site ?? ""}/>}<span>{bookmark.label}</span>
      </button>)}
    </div>
); }
