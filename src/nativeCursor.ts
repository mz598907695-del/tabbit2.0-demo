import { getCurrentWindow, type CursorIcon } from '@tauri-apps/api/window';

export function setNativeCursor(icon: CursorIcon) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  void getCurrentWindow().setCursorIcon(icon).catch(error => {
    console.warn('Unable to update the native cursor', error);
  });
}
