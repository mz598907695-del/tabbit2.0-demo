import { getHomeRoot } from "./home-host";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "./icons";
import "./shortcut-grid.css";

export function normalizeShortcutUrl(value) {
  const input = value.trim();
  if (!input) throw new Error("请输入网址");
  const scheme = input.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  const isHostWithPort = /^(?:localhost|[\w.-]+\.[a-z\d-]+):\d+(?:[/?#]|$)/i.test(input);
  if (scheme && !["http", "https"].includes(scheme) && !isHostWithPort) {
    throw new Error("仅支持 http 或 https 网址");
  }
  let address;
  try {
    address = new URL(input.startsWith("//") ? `https:${input}` : scheme && !isHostWithPort ? input : `https://${input}`);
  } catch {
    throw new Error("请输入有效网址，例如 example.com");
  }
  if (!["http:", "https:"].includes(address.protocol) || !address.hostname) {
    throw new Error("仅支持 http 或 https 网址");
  }
  return address.href;
}

function AddShortcutDialog({ onAdd, onDismiss }) {
  const id = useId();
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const urlRef = useRef(null);
  const backdropDown = useRef(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    nameRef.current.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const dismiss = () => {
    dialogRef.current.close();
    onDismiss();
  };
  const outside = (event) => {
    if (event.target !== dialogRef.current) return false;
    const rect = dialogRef.current.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  const submit = (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError({ field: "name", message: "请输入快捷方式名称" });
      nameRef.current.focus();
      return;
    }
    let cleanUrl;
    try {
      cleanUrl = normalizeShortcutUrl(url);
    } catch (reason) {
      setError({ field: "url", message: reason.message });
      urlRef.current.focus();
      return;
    }
    onAdd({ name: cleanName, url: cleanUrl });
    dismiss();
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="shortcut-add-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); dismiss(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        }
      }}
      onPointerDown={(event) => { backdropDown.current = outside(event); }}
      onClick={(event) => { if (backdropDown.current && outside(event)) dismiss(); }}
    >
      <form className="shortcut-add-form" onSubmit={submit} noValidate>
        <div className="shortcut-add-heading">
          <h2 id={`${id}-title`}>添加快捷方式</h2>
          <button type="button" className="shortcut-add-close" aria-label="关闭添加快捷方式" onClick={dismiss}><X size={18} /></button>
        </div>
        <label className="shortcut-add-field" htmlFor={`${id}-name`}>
          <span>名称</span>
          <input ref={nameRef} id={`${id}-name`} value={name} onChange={(event) => { setName(event.target.value); if (error?.field === "name") setError(null); }} placeholder="例如：我的常用网站" maxLength={60} autoComplete="off" required aria-invalid={error?.field === "name" || undefined} aria-describedby={error?.field === "name" ? `${id}-error` : undefined} />
        </label>
        <label className="shortcut-add-field" htmlFor={`${id}-url`}>
          <span>网址</span>
          <input ref={urlRef} id={`${id}-url`} value={url} onChange={(event) => { setUrl(event.target.value); if (error?.field === "url") setError(null); }} placeholder="https://example.com" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} required aria-invalid={error?.field === "url" || undefined} aria-describedby={error?.field === "url" ? `${id}-error` : undefined} />
        </label>
        {error && <p className="shortcut-add-error" id={`${id}-error`} role="alert">{error.message}</p>}
        <div className="shortcut-add-actions">
          <button type="button" className="shortcut-add-cancel" onClick={dismiss}>取消</button>
          <button type="submit" className="shortcut-add-submit">添加</button>
        </div>
      </form>
    </dialog>,
    getHomeRoot(),
  );
}

export default function ShortcutGrid({ items, label, showLabels = true, showAddButton = true, appearanceTheme, onAdd, onEditingChange }) {
  const gridRef = useRef(null);
  const menuRef = useRef(null);
  const menuItemRef = useRef(null);
  const returnFocusRef = useRef(null);
  const editingCallback = useRef(onEditingChange);
  const [menu, setMenu] = useState(null);
  const [editing, setEditing] = useState(false);
  const busy = Boolean(menu || editing);
  editingCallback.current = onEditingChange;

  useEffect(() => { editingCallback.current?.(busy); }, [busy]);
  useEffect(() => () => { editingCallback.current?.(false); }, []);

  const restoreFocus = () => {
    const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : gridRef.current;
    target?.focus({ preventScroll: true });
  };
  const closeMenu = (restore = false) => {
    setMenu(null);
    if (restore) restoreFocus();
  };
  const openDialog = (trigger) => {
    if (trigger) returnFocusRef.current = trigger;
    setMenu(null);
    setEditing(true);
  };
  const openMenu = (event, keyboard = false) => {
    if (event.target.closest("a")) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = gridRef.current.getBoundingClientRect();
    returnFocusRef.current = event.target.tabIndex >= 0 ? event.target : gridRef.current;
    setMenu({
      x: keyboard || (event.clientX === 0 && event.clientY === 0) ? rect.left + 12 : event.clientX,
      y: keyboard || (event.clientX === 0 && event.clientY === 0) ? rect.top + 12 : event.clientY,
    });
  };

  useLayoutEffect(() => {
    if (!menu) return;
    const node = menuRef.current;
    const rect = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8))}px`;
    menuItemRef.current.focus({ preventScroll: true });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const outside = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(null); };
    const dismiss = () => setMenu(null);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [menu]);

  return <>
    <nav ref={gridRef} className={`shortcuts shortcut-grid${showLabels === false ? " labels-hidden" : ""}`} aria-label={label} tabIndex={0} onContextMenu={openMenu} onKeyDown={(event) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) openMenu(event, true);
    }}>
      {items.map((item) => {
        const image = appearanceTheme === "dark" ? item.darkImage || item.image : item.image;
        return <a className="shortcut" href={item.url} key={item.id} target="_blank" rel="noreferrer" aria-label={`打开 ${item.service || item.label}`} title={item.service || item.label}>
          <span className="shortcut-icon" data-brand={item.key}>
            {image ? <img src={image} alt="" width="24" height="24" /> : <span className="shortcut-fallback" aria-hidden="true">{Array.from(item.label.trim())[0] || "网"}</span>}
          </span>
          <span className="shortcut-label" aria-hidden={showLabels === false}>{item.label}</span>
        </a>;
      })}
      {showAddButton && <button type="button" className="shortcut shortcut-add" title="添加快捷方式" aria-label="添加快捷方式" aria-haspopup="dialog" onClick={(event) => openDialog(event.currentTarget)}>
        <span className="shortcut-icon"><Plus size={22} aria-hidden="true" /></span>
        <span className="shortcut-label" aria-hidden={showLabels === false}>添加快捷方式</span>
      </button>}
    </nav>
    {menu && createPortal(<div ref={menuRef} className="shortcut-context-menu" role="menu" aria-label="快捷方式操作" style={{ left: menu.x, top: menu.y }} onKeyDown={(event) => {
      if (["Escape", "Tab"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); closeMenu(true);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault(); menuItemRef.current.focus();
      }
    }}>
      <button ref={menuItemRef} type="button" role="menuitem" onClick={() => openDialog()}><Plus size={16} aria-hidden="true" />添加快捷方式</button>
    </div>, getHomeRoot())}
    {editing && <AddShortcutDialog onAdd={onAdd} onDismiss={() => { setEditing(false); restoreFocus(); }} />}
  </>;
}
