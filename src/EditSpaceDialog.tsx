import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SpaceIcon, { type SpaceAppearance } from "./SpaceIcon";
import { spaceIconOptions } from "./spaceIcons";
import "./DeleteSpaceDialog.css";
import "./EditSpaceDialog.css";

export default function EditSpaceDialog({ space, onCancel, onConfirm }: { space: SpaceAppearance; onCancel: () => void; onConfirm: (space: SpaceAppearance) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(space);
  const [pickerOpen, setPickerOpen] = useState(false);
  const valid = Boolean(draft.name.trim());
  const save = () => { if (valid) onConfirm({ ...draft, name: draft.name.trim() }); };
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
    const close = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); onCancel(); };
    const keydown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") close(event); };
    window.addEventListener("tabbit-close-tab", close, true);
    window.addEventListener("keydown", keydown, true);
    return () => { window.removeEventListener("tabbit-close-tab", close, true); window.removeEventListener("keydown", keydown, true); dialog.close(); };
  }, [onCancel]);

  return createPortal(<dialog ref={ref} tabIndex={-1} className="delete-space-dialog edit-space-dialog" aria-label="编辑空间" onCancel={(event) => { event.preventDefault(); if (pickerOpen) setPickerOpen(false); else onCancel(); }} onPointerDown={(event) => {
    if (!(event.target as HTMLElement).closest("input, button, label, .edit-space-input-row, .edit-space-icon-picker")) {
      inputRef.current?.setSelectionRange(inputRef.current.selectionEnd ?? 0, inputRef.current.selectionEnd ?? 0);
      ref.current?.focus({ preventScroll: true });
    }
  }} onClick={(event) => { if (!(event.target as HTMLElement).closest(".edit-space-icon-control")) setPickerOpen(false); }}>
    <div className="edit-space-field">
      <div id="edit-space-name-label" className="edit-space-label">空间名称</div>
      <div className="edit-space-input-row">
        <div className="edit-space-icon-control">
          <button type="button" className="edit-space-icon-button" aria-label="选择空间图标" aria-expanded={pickerOpen} onClick={() => setPickerOpen((open) => !open)}><SpaceIcon space={draft}/></button>
          {pickerOpen && <div className="dropdown-panel edit-space-icon-picker" role="group" aria-label="空间图标">
            <div className="edit-space-icon-grid">
            {spaceIconOptions.map((icon) => <button key={icon.name} type="button" className={draft.icon === icon.src ? "selected" : ""} aria-label={`选择${icon.name}`} aria-pressed={draft.icon === icon.src} onClick={() => { setDraft((current) => ({ ...current, icon: icon.src })); setPickerOpen(false); }}><img src={icon.src} alt="" draggable={false}/></button>)}
            </div>
          </div>}
        </div>
        <input ref={inputRef} id="edit-space-name" aria-labelledby="edit-space-name-label" value={draft.name} maxLength={24} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); save(); } }}/>
      </div>
    </div>
    <div className="delete-space-actions edit-space-actions">
      <button type="button" className="delete-space-cancel" onClick={onCancel}>取消</button>
      <button type="button" className="edit-space-confirm" disabled={!valid} onClick={save}>确认修改</button>
    </div>
  </dialog>, document.body);
}
