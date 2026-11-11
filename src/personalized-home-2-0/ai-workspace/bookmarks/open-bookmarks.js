import { BOOKMARKS_TAB_ID, INTERNAL_TAB_EVENT } from '../../../browser/tabs-data';

// Ask the current Tabbit window to create and select an application tab.
export function openBookmarkPage() {
  window.dispatchEvent(new CustomEvent(INTERNAL_TAB_EVENT, { detail: { id: BOOKMARKS_TAB_ID, title: '收藏管理' } }));
}

export function openBookmarkTab(event) {
  event.preventDefault();
  openBookmarkPage();
}
