import { useEffect, useRef, useState } from 'react';
import { canMoveTo, selectionRoots } from './bookmark-model';

export default function useBookmarkGestures({ library, live, ui, setUI, selection, setSelection, parentId, smart, query, sort, kind, trash, listRef, move, notify, blocked }) {
  const [dragging, setDragging] = useState(null), [drop, setDrop] = useState(null), [marquee, setMarquee] = useState(null);
  const dragRef = useRef(null), dropRef = useRef(null), hoverTimer = useRef(null), hoverTarget = useRef(null), marqueeRef = useRef(null), frame = useRef(null);
  useEffect(() => () => { clearTimeout(hoverTimer.current); cancelAnimationFrame(frame.current); }, []);
  function finishDrag() { dragRef.current = null; dropRef.current = null; setDragging(null); setDrop(null); clearTimeout(hoverTimer.current); hoverTarget.current = null; }
  function dragProps(node) {
    return { draggable: !node.deletedAt && !node.systemRoot && !blocked,
      onDragStart: event => {
        if (node.systemRoot || event.target.closest('input')) { event.preventDefault(); return; }
        const ids = selection.includes(node.id) ? selection : [node.id];
        dragRef.current = ids; setDragging(ids); setSelection(ids);
        event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-tabbit-bookmarks', JSON.stringify(ids));
        const ghost = document.createElement('div'); ghost.className = 'bkm-drag-ghost'; ghost.textContent = `移动 ${selectionRoots(live, ids).length} 项`; event.currentTarget.closest('.bkm-app').appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, 18, 18); requestAnimationFrame(() => ghost.remove());
      }, onDragEnd: finishDrag };
  }
  function dropProps(targetId, area, node, containerId = parentId) {
    return {
      'data-drop-id': targetId || 'root',
      'data-drop-state': drop?.targetId === targetId && drop?.area === area ? drop.position : undefined,
      onDragOver: event => {
        const ids = dragRef.current; if (!ids || trash) return;
        event.preventDefault(); event.stopPropagation();
        let destination = targetId, position = 'inside';
        if (area === 'row' || area === 'column-row') {
          const rect = event.currentTarget.getBoundingClientRect(), fraction = (event.clientY - rect.top) / rect.height;
          if (!smart && !query && (area === 'column-row' ? (ui.sorts[containerId] || 'manual') : sort) === 'manual' && kind === 'all' && (node.kind !== 'folder' || fraction < .22 || fraction > .78)) { destination = containerId; position = fraction < .5 ? 'before' : 'after'; }
          else if (node.kind !== 'folder') { event.dataTransfer.dropEffect = 'none'; dropRef.current = null; setDrop(null); return; }
        }
        const valid = canMoveTo(library, ids, destination) && !(position !== 'inside' && ids.includes(targetId));
        event.dataTransfer.dropEffect = valid ? 'move' : 'none';
        dropRef.current = { targetId, destination, area, position: valid ? position : 'invalid' }; setDrop(dropRef.current);
        if (area === 'tree' && valid && !ui.expanded.includes(targetId) && hoverTarget.current !== targetId) {
          clearTimeout(hoverTimer.current); hoverTarget.current = targetId;
          hoverTimer.current = setTimeout(() => setUI(previous => ({ ...previous, expanded: [...new Set([...previous.expanded, targetId])] })), 650);
        } else if (hoverTarget.current !== targetId) { clearTimeout(hoverTimer.current); hoverTarget.current = targetId; }
        const scroller = event.currentTarget.closest('.bkm-tree-scroll,.bkm-column-list,.bkm-list-scroll');
        if (scroller) { const rect = scroller.getBoundingClientRect(); if (event.clientY < rect.top + 36) scroller.scrollTop -= 16; if (event.clientY > rect.bottom - 36) scroller.scrollTop += 16; }
      },
      onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) { clearTimeout(hoverTimer.current); hoverTarget.current = null; } },
      onDrop: event => {
        event.preventDefault(); event.stopPropagation(); const ids = dragRef.current, target = dropRef.current;
        if (ids && target?.targetId === targetId && target.area === area && target.position !== 'invalid') {
          try { move(ids, target.destination, target.position === 'before' ? { beforeId: targetId } : target.position === 'after' ? { afterId: targetId } : {}); } catch (error) { notify(error.message, true); }
        }
        finishDrag();
      },
    };
  }
  function marqueeStart(event) {
    if (event.button !== 0 || event.target.closest('button,input,a,[data-bookmark-id],.bkm-list-head,.bkm-column-heading,.bkm-column-preview') || blocked) return;
    const scroller = event.target.closest('.bkm-column-list') || listRef.current;
    if (!scroller || (scroller.classList.contains('is-columns') && !event.target.closest('.bkm-column-list'))) return;
    const rect = scroller.getBoundingClientRect();
    const bounds = [...scroller.querySelectorAll('[data-bookmark-id]')].map(element => { const row = element.getBoundingClientRect(); return { id: element.dataset.bookmarkId, left: row.left - rect.left, right: row.right - rect.left, top: row.top - rect.top + scroller.scrollTop, bottom: row.bottom - rect.top + scroller.scrollTop }; });
    if (!bounds.length) return;
    marqueeRef.current = { scroller, x: event.clientX - rect.left, y: event.clientY - rect.top + scroller.scrollTop, clientY: event.clientY, clientX: event.clientX, rect, bounds, base: event.metaKey || event.ctrlKey ? selection : [], started: false, pointerId: event.pointerId };
    scroller.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function updateMarquee() {
    const state = marqueeRef.current; if (!state) return;
    const scroller = state.scroller;
    const { rect } = state;
    if (state.started) { if (state.clientY < rect.top + 30) scroller.scrollTop -= 10; if (state.clientY > rect.bottom - 30) scroller.scrollTop += 10; }
    const x = Math.max(0, Math.min(rect.width, state.clientX - rect.left)), y = Math.max(0, state.clientY - rect.top + scroller.scrollTop);
    if (Math.abs(x - state.x) + Math.abs(y - state.y) > 5) state.started = true;
    if (state.started) {
      const box = { left: Math.min(x, state.x), top: Math.min(y, state.y), width: Math.abs(x - state.x), height: Math.abs(y - state.y) };
      setMarquee({ ...box, containerId: scroller.dataset.columnId || null }); setSelection([...new Set([...state.base, ...state.bounds.filter(row => row.right >= box.left && row.left <= box.left + box.width && row.bottom >= box.top && row.top <= box.top + box.height).map(row => row.id)])]);
    }
    frame.current = requestAnimationFrame(updateMarquee);
  }
  function marqueeMove(event) {
    if (!marqueeRef.current) return;
    marqueeRef.current.clientX = event.clientX; marqueeRef.current.clientY = event.clientY;
    cancelAnimationFrame(frame.current); updateMarquee();
  }
  function marqueeEnd(_event, cancel = false) {
    const state = marqueeRef.current; if (!state) return;
    if (cancel || !state.started) setSelection(state.base);
    marqueeRef.current = null; cancelAnimationFrame(frame.current); setMarquee(null);
    if (state.scroller.hasPointerCapture(state.pointerId)) state.scroller.releasePointerCapture(state.pointerId);
  }
  return { dragging, dragProps, dropProps, marquee, cancelGesture: event => { if (marqueeRef.current) marqueeEnd(event, true); finishDrag(); },
    marqueeHandlers: { onPointerDown: marqueeStart, onPointerMove: marqueeMove, onPointerUp: marqueeEnd, onPointerCancel: event => marqueeEnd(event, true), onLostPointerCapture: event => marqueeEnd(event, true) } };
}
