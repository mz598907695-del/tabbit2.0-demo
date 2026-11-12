import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import warningIcon from "./assets/delete-space-warning.webp";
import "./DeleteSpaceDialog.css";

export default function DeleteSpaceDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    const close = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); onCancel(); };
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") close(event);
    };
    window.addEventListener("tabbit-close-tab", close, true);
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("tabbit-close-tab", close, true);
      window.removeEventListener("keydown", keydown, true);
      dialog.close();
    };
  }, [onCancel]);

  return createPortal(<dialog ref={ref} tabIndex={-1} className="delete-space-dialog" role="alertdialog" aria-labelledby="delete-space-title" aria-describedby="delete-space-description" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <div className="delete-space-content">
      <img className="delete-space-warning" src={warningIcon} alt="" draggable={false}/>
      <h2 id="delete-space-title">删除空间</h2>
      <p id="delete-space-description">空间删除后不可恢复，确定要删除吗</p>
    </div>
    <div className="delete-space-actions">
      <button type="button" className="delete-space-cancel" onClick={onCancel}>取消</button>
      <button type="button" className="delete-space-confirm" onClick={onConfirm}>确认删除</button>
    </div>
  </dialog>, document.body);
}
