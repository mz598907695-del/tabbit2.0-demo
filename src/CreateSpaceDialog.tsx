import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./DeleteSpaceDialog.css";
import "./EditSpaceDialog.css";
import "./CreateSpaceDialog.css";
import { spaceColors as themes } from './spaceColors';


export default function CreateSpaceDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (name: string, theme: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState(themes[0].color);
  const save = () => { if (name.trim()) onConfirm(name.trim(), theme); };
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    inputRef.current?.focus({ preventScroll: true });
    const close = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); onCancel(); };
    const keydown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") close(event); };
    window.addEventListener("tabbit-close-tab", close, true);
    window.addEventListener("keydown", keydown, true);
    return () => { window.removeEventListener("tabbit-close-tab", close, true); window.removeEventListener("keydown", keydown, true); dialog.close(); };
  }, [onCancel]);

  return createPortal(<dialog ref={ref} tabIndex={-1} className="delete-space-dialog create-space-dialog" aria-labelledby="create-space-title" onCancel={(event) => { event.preventDefault(); onCancel(); }} onPointerDown={(event) => { if (!(event.target as HTMLElement).closest("input, button, .edit-space-input-row")) ref.current?.focus({ preventScroll: true }); }}>
    <div className="create-space-intro">
      <h2 id="create-space-title">创建一个新空间</h2>
      <p>把工作、生活和不同项目分开放置，每个空间都有独立的标签页与外观，需要时随时切换。</p>
    </div>
    <div className="edit-space-field">
      <div id="create-space-name-label" className="edit-space-label">空间名称</div>
      <div className="edit-space-input-row"><input ref={inputRef} aria-labelledby="create-space-name-label" placeholder="请输入" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); save(); } }}/></div>
    </div>
    <div className="edit-space-field">
      <div id="create-space-theme-label" className="edit-space-label">主题</div>
      <div className="create-space-themes" role="group" aria-labelledby="create-space-theme-label">{themes.map((item) => <button key={item.color} type="button" aria-label={`${item.name}主题`} aria-pressed={theme === item.color} className={theme === item.color ? "selected" : ""} style={{ "--theme-color": item.color } as React.CSSProperties} onClick={() => setTheme(item.color)}><span/></button>)}</div>
    </div>
    <div className="delete-space-actions edit-space-actions"><button type="button" className="delete-space-cancel" onClick={onCancel}>取消</button><button type="button" className="edit-space-confirm" disabled={!name.trim()} onClick={save}>创建空间</button></div>
  </dialog>, document.body);
}
