// Open the destination only after the browser has created a separate tab.
export function openBookmarkTab(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = event.currentTarget.href;
  const tab = window.open('about:blank', '_blank');
  if (!tab) return;
  event.preventDefault();
  tab.opener = null;
  tab.location.href = href;
}
