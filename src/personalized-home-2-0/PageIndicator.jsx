import { useVisibilityMotion } from './useVisibilityMotion';
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { TextCursorInput, Plus, Controls, Trash2, X } from "./icons";
import { BoardConfirm } from "./board/BoardDialogs";
import { isPageGestureClick, pageDragPosition, pageEdgeVelocity, pagePreviewOffset } from "./page-reorder";
import "./page-indicator.css";
import "./context-menu.css";

const defaultPages = [{ name: "工作" }, { name: "常用" }, { name: "灵感" }];

function usePageReorder({ pages, onReorder, onStart, capsuleRef }) {
  const [preview, setPreview] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const sessionRef = useRef(null);
  const clickBlockRef = useRef(null);
  const clickTimerRef = useRef(0);
  const focusFrameRef = useRef(0);
  const latest = useRef({ pages, onReorder, onStart });
  latest.current = { pages, onReorder, onStart };

  function clearClickBlock() {
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = 0;
    clickBlockRef.current = null;
  }

  function blockGestureClick(pointerId, released) {
    clearClickBlock();
    clickBlockRef.current = pointerId;
    if (released) clickTimerRef.current = window.setTimeout(clearClickBlock, 0);
  }

  function endSession(reason, commit = false) {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    cancelAnimationFrame(session.frame);
    session.button.style.transform = "";
    if (session.button.hasPointerCapture(session.pointerId)) session.button.releasePointerCapture(session.pointerId);
    if (reason === "pointercancel" || reason === "unmount") clearClickBlock();
    else if (session.active || reason !== "pointerup") blockGestureClick(session.pointerId, reason === "pointerup");
    if (reason !== "unmount") setPreview(null);

    if (commit && session.active && session.targetIndex !== session.from) {
      latest.current.onReorder?.(session.pageId, session.targetIndex);
      setAnnouncement(`已将${session.name}移到第 ${session.targetIndex + 1} 个位置，共 ${session.count} 个页面`);
    } else if (session.active && reason === "escape") setAnnouncement("已取消页面排序");
    if (reason === "pointerup" || reason === "escape") {
      cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = requestAnimationFrame(() => {
        if (session.button.isConnected) session.button.focus({ preventScroll: true });
      });
    }
  }

  function updatePreview(session) {
    const capsule = capsuleRef.current;
    if (!capsule || !session.active) return;
    const position = pageDragPosition({
      pointerDelta: session.clientX - session.startX,
      scrollLeft: capsule.scrollLeft, startScroll: session.startScroll,
      origin: session.origin, firstCenter: session.firstCenter, pitch: session.pitch,
      count: session.count, viewportWidth: capsule.clientWidth,
    });
    session.button.style.transform = `translateX(${position.offset}px)`;
    if (session.targetIndex !== position.targetIndex || !session.previewStarted) {
      session.targetIndex = position.targetIndex;
      session.previewStarted = true;
      setPreview({ pageId: session.pageId, from: session.from, to: session.targetIndex, pitch: session.pitch, marker: session.firstCenter + session.targetIndex * session.pitch });
    }
  }

  function edgeScroll(time) {
    const session = sessionRef.current;
    if (!session?.active) return;
    session.frame = 0;
    const capsule = capsuleRef.current;
    const rect = capsule.getBoundingClientRect();
    const maxScroll = capsule.scrollWidth - capsule.clientWidth;
    const velocity = pageEdgeVelocity(session.clientX, rect.left, rect.right, capsule.scrollLeft, maxScroll);
    if (!velocity) { session.lastTime = 0; return; }
    const elapsed = session.lastTime ? Math.min(32, time - session.lastTime) : 16;
    session.lastTime = time;
    capsule.scrollLeft = Math.max(0, Math.min(maxScroll, capsule.scrollLeft + velocity * elapsed / 1000));
    updatePreview(session);
    session.frame = requestAnimationFrame(edgeScroll);
  }

  function start(event, page, index) {
    if (!latest.current.onReorder || pages.length < 2 || page.id == null || sessionRef.current || event.isPrimary === false || event.button !== 0 || event.ctrlKey) return;
    clearClickBlock();
    const capsule = capsuleRef.current;
    const buttons = [...capsule.querySelectorAll('.page-indicator-page')];
    const button = event.currentTarget;
    const firstCenter = buttons[0].offsetLeft + buttons[0].offsetWidth / 2;
    const pitch = buttons[1].offsetLeft - buttons[0].offsetLeft;
    sessionRef.current = {
      pageId: page.id, name: page.name, from: index, targetIndex: index, count: pages.length,
      button, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      clientX: event.clientX, startScroll: capsule.scrollLeft, viewportWidth: capsule.clientWidth,
      origin: button.offsetLeft + button.offsetWidth / 2, firstCenter, pitch,
      active: false, frame: 0, lastTime: 0,
    };
    button.setPointerCapture(event.pointerId);
  }

  function move(event) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.clientX = event.clientX;
    if (!session.active) {
      if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < 6) return;
      session.active = true;
      latest.current.onStart();
    }
    event.preventDefault();
    updatePreview(session);
    if (!session.frame) session.frame = requestAnimationFrame(edgeScroll);
  }

  function pointerUp(event) {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    if (sessionRef.current.active) event.preventDefault();
    endSession("pointerup", true);
  }

  function captureClick(event) {
    if (!isPageGestureClick(clickBlockRef.current, event.nativeEvent.pointerId, event.detail)) return;
    clearClickBlock();
    event.preventDefault();
    event.stopPropagation();
  }

  function keyboard(event, page, index) {
    if (!onReorder || page.id == null || !event.altKey || event.ctrlKey || event.metaKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return false;
    event.preventDefault();
    event.stopPropagation();
    endSession("keyboard");
    latest.current.onStart();
    const targetIndex = Math.max(0, Math.min(pages.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
    if (targetIndex !== index) {
      onReorder(page.id, targetIndex);
      setAnnouncement(`已将${page.name}移到第 ${targetIndex + 1} 个位置，共 ${pages.length} 个页面`);
      const button = event.currentTarget;
      cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = requestAnimationFrame(() => {
        if (!button.isConnected) return;
        button.focus({ preventScroll: true });
        button.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      });
    }
    return true;
  }

  useLayoutEffect(() => { endSession("pages"); }, [pages]);
  useEffect(() => {
    const cancel = () => endSession("cancel");
    const keydown = event => {
      if (event.key !== "Escape" || !sessionRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      endSession("escape");
    };
    const release = event => {
      if (clickBlockRef.current === event.pointerId) clickTimerRef.current = window.setTimeout(clearClickBlock, 0);
    };
    const releaseOutside = event => {
      if (event.buttons === 0 && clickBlockRef.current === event.pointerId) clearClickBlock();
    };
    const cancelPointer = event => {
      if (sessionRef.current?.pointerId === event.pointerId) endSession("pointercancel");
      if (clickBlockRef.current === event.pointerId) clearClickBlock();
    };
    const visibility = () => { if (document.hidden) cancel(); };
    const observer = new ResizeObserver(() => {
      if (sessionRef.current && capsuleRef.current?.clientWidth !== sessionRef.current.viewportWidth) cancel();
    });
    if (capsuleRef.current) observer.observe(capsuleRef.current);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", clearClickBlock, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointermove", releaseOutside, true);
    document.addEventListener("pointercancel", cancelPointer, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", clearClickBlock, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointermove", releaseOutside, true);
      document.removeEventListener("pointercancel", cancelPointer, true);
      endSession("unmount");
      clearClickBlock();
      cancelAnimationFrame(focusFrameRef.current);
    };
  }, []);

  return {
    preview, announcement, start, move, pointerUp, captureClick, keyboard,
    engaged: () => Boolean(sessionRef.current || clickBlockRef.current != null),
    dragging: () => Boolean(sessionRef.current?.active),
    cancel: () => endSession("cancel"),
    lostCapture: event => { if (sessionRef.current?.pointerId === event.pointerId) endSession("cancel"); },
    scroll: () => { if (sessionRef.current?.active) updatePreview(sessionRef.current); },
  };
}

export function PageIndicator({
  visible = true,
  pages = defaultPages,
  selectedIndex = 0,
  onSelect,
  onAdd,
  onManage,
  onRename,
  onDelete,
  onBusyChange,
  onReorder,
}) {
  const [editingPageId, setEditingPageId] = useState(null);
  const [deletingPageId, setDeletingPageId] = useState(null);
  const [pageMenu, setPageMenu] = useState(null);
  const [name, setName] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(tooltipTimer.current), []);
  const rootRef = useRef(null);
  const indicatorPresent = useVisibilityMotion(rootRef, visible, 32);
  const previousPageIndex = useRef(selectedIndex);
  const fillAnimations = useRef([]);
  const swipePreview = useRef(null);
  useLayoutEffect(() => {
    const previous = previousPageIndex.current;
    previousPageIndex.current = selectedIndex;
    if (previous === selectedIndex) return;
    const preview = swipePreview.current;
    const followingGesture = preview?.from === previous && preview?.to === selectedIndex;
    swipePreview.current = null;
    fillAnimations.current.forEach(animation => animation.cancel());
    fillAnimations.current = [];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const forward = selectedIndex > previous;
    const enterFrom = forward ? 'translateX(-100%)' : 'translateX(100%)';
    const exitTo = forward ? 'translateX(100%)' : 'translateX(-100%)';
    const full = 'translateX(0)';
    for (const [index, from, to] of [[previous, full, exitTo], [selectedIndex, enterFrom, full]]) {
      const fill = rootRef.current?.querySelector(`[data-page-index="${index}"] .page-indicator-fill`);
      if (fill) {
        const start = followingGesture ? fill.style.transform || from : from;
        fillAnimations.current.push(fill.animate([{ transform: start }, { transform: to }], {
          duration: 300, easing: 'cubic-bezier(.2, 0, 0, 1)',
        }));
        fill.style.removeProperty('transform');
      }
    }
  }, [selectedIndex]);
  useEffect(() => () => fillAnimations.current.forEach(animation => animation.cancel()), []);
  useEffect(() => {
    const home = rootRef.current?.closest('.home');
    if (!home) return;
    const fillAt = index => rootRef.current?.querySelector(`[data-page-index="${index}"] .page-indicator-fill`);
    function progress(event) {
      const next = event.detail;
      const old = swipePreview.current;
      if (!next) {
        if (!old) return;
        fillAnimations.current.forEach(animation => animation.cancel());
        fillAnimations.current = [];
        for (const index of [old.from, old.to]) {
          const fill = fillAt(index);
          if (!fill) continue;
          const from = fill.style.transform;
          fill.style.removeProperty('transform');
          const to = index === previousPageIndex.current ? 'translateX(0)' : `translateX(${old.to > old.from ? -100 : 100}%)`;
          fillAnimations.current.push(fill.animate([{ transform: from }, { transform: to }], {
            duration: 300, easing: 'cubic-bezier(.2, 0, 0, 1)',
          }));
        }
        swipePreview.current = null;
        return;
      }
      fillAnimations.current.forEach(animation => animation.cancel());
      fillAnimations.current = [];
      if (old && (old.from !== next.from || old.to !== next.to)) {
        for (const index of [old.from, old.to]) fillAt(index)?.style.removeProperty('transform');
      }
      const direction = next.to > next.from ? 1 : -1;
      const pageWidth = home.querySelector('.workspace-board')?.clientWidth || home.clientWidth;
      const fillProgress = Number.isFinite(next.distance)
        ? Math.min(1, Math.abs(next.distance) / Math.max(1, pageWidth))
        : next.progress;
      const from = fillAt(next.from), to = fillAt(next.to);
      if (from) from.style.transform = `translateX(${direction * fillProgress * 100}%)`;
      if (to) to.style.transform = `translateX(${-direction * (1 - fillProgress) * 100}%)`;
      swipePreview.current = { ...next, progress: fillProgress };
    }
    home.addEventListener('page-swipe-progress', progress);
    return () => home.removeEventListener('page-swipe-progress', progress);
  }, []);
  const capsuleRef = useRef(null);
  const addButtonRef = useRef(null);
  const manageButtonRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const actionTriggerRef = useRef(null);
  const formId = useId();
  const tooltipId = useId();
  const menuId = useId();
  const reorderHelpId = useId();
  const isFormOpen = editingPageId !== null;
  const deletingPage = pages.find((entry) => entry.id === deletingPageId);
  const reorder = usePageReorder({ pages, onReorder, capsuleRef, onStart: () => {
    window.clearTimeout(tooltipTimer.current);
    setTooltip(null);
    setPageMenu(null);
    setEditingPageId(null);
  } });
  const isReordering = Boolean(reorder.preview);

  useEffect(() => {
    onBusyChange?.(Boolean(isFormOpen || pageMenu || deletingPage || isReordering));
    return () => onBusyChange?.(false);
  }, [isFormOpen, pageMenu, Boolean(deletingPage), isReordering, onBusyChange]);

  function tooltipPosition(anchor) {
    const root = rootRef.current.getBoundingClientRect();
    const bounds = anchor.getBoundingClientRect();
    const home = rootRef.current.closest(".home").getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    return {
      x: center - root.left,
      maxWidth: Math.max(24, Math.min(280, 2 * Math.min(center - home.left, home.right - center) - 16)),
    };
  }

  function showTooltip(event, label) {
    if (reorder.engaged() || isFormOpen || pageMenu || deletingPage || event.pointerType === "touch") return;
    const anchor = event.currentTarget;
    window.clearTimeout(tooltipTimer.current);
    tooltipTimer.current = window.setTimeout(() => {
      if (anchor.isConnected && (anchor.matches(':hover') || anchor.matches(':focus-visible'))) {
        setTooltip({ anchor, label, ...tooltipPosition(anchor) });
      }
    }, 400);
  }

  function hideTooltip(event) {
    window.clearTimeout(tooltipTimer.current);
    const anchor = event.currentTarget;
    setTooltip((current) => current?.anchor === anchor ? null : current);
  }

  function tooltipHandlers(label) {
    return {
      onPointerEnter: (event) => showTooltip(event, label),
      onPointerLeave: hideTooltip,
      onFocus: (event) => {
        if (event.currentTarget.matches(":focus-visible")) showTooltip(event, label);
      },
      onBlur: hideTooltip,
    };
  }

  useLayoutEffect(() => {
    if (!tooltip) return undefined;
    const { anchor } = tooltip;
    function reposition() {
      const position = tooltipPosition(anchor);
      setTooltip((current) => current?.anchor === anchor && (current.x !== position.x || current.maxWidth !== position.maxWidth)
        ? { ...current, ...position } : current);
    }
    const observer = new ResizeObserver(reposition);
    observer.observe(rootRef.current);
    observer.observe(anchor);
    observer.observe(rootRef.current.closest(".home"));
    return () => observer.disconnect();
  }, [tooltip?.anchor]);

  useEffect(() => {
    if (!tooltip) return undefined;
    function dismiss(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(tooltipTimer.current);
    setTooltip(null);
    }
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [Boolean(tooltip)]);

  useLayoutEffect(() => {
    if (isFormOpen) {
      inputRef.current?.focus({ preventScroll: true });
      if (editingPageId !== null) inputRef.current?.select();
    }
  }, [isFormOpen, editingPageId]);

  useEffect(() => {
    if (!isFormOpen && !pageMenu) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setEditingPageId(null);
        setPageMenu(null);
      }
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setEditingPageId(null);
      setPageMenu(null);
      (actionTriggerRef.current || addButtonRef.current)?.focus({ preventScroll: true });
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isFormOpen, pageMenu]);

  useLayoutEffect(() => {
    if (!pageMenu) return;
    const menu = menuRef.current;
    const home = rootRef.current.closest(".home");
    function reposition() {
      const root = rootRef.current.getBoundingClientRect();
      const bounds = actionTriggerRef.current?.getBoundingClientRect();
      const region = home.getBoundingClientRect();
      const halfWidth = menu.getBoundingClientRect().width / 2;
      const center = bounds ? bounds.left + bounds.width / 2 : root.left + pageMenu.x;
      const left = Math.max(region.left + halfWidth + 8, Math.min(center, region.right - halfWidth - 8));
      menu.style.left = `${left - root.left}px`;
    }
    reposition();
    menu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    const observer = new ResizeObserver(reposition);
    observer.observe(home);
    window.addEventListener("resize", reposition);
    return () => { observer.disconnect(); window.removeEventListener("resize", reposition); };
  }, [pageMenu]);

  function openPageMenu(event, targetPage) {
    if (reorder.dragging()) { event.preventDefault(); event.stopPropagation(); return; }
    reorder.cancel();
    if (!onRename && !onDelete) return;
    event.preventDefault();
    event.stopPropagation();
    const anchor = event.currentTarget;
    const root = rootRef.current.getBoundingClientRect();
    const bounds = anchor.getBoundingClientRect();
    const home = rootRef.current.closest(".home").getBoundingClientRect();
    const center = Math.max(home.left + 84, Math.min(bounds.left + bounds.width / 2, home.right - 84));
    actionTriggerRef.current = anchor;
    window.clearTimeout(tooltipTimer.current);
    setTooltip(null);
    setEditingPageId(null);
    setPageMenu({ id: targetPage.id, x: center - root.left });
  }

  function restorePageFocus() {
    const trigger = actionTriggerRef.current;
    requestAnimationFrame(() => {
      const target = trigger?.isConnected ? trigger : rootRef.current?.querySelector('[aria-pressed="true"]');
      target?.focus({ preventScroll: true });
    });
  }

  function closeForm() {
    setEditingPageId(null);
    (actionTriggerRef.current || addButtonRef.current)?.focus({ preventScroll: true });
  }

  function renamePage(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    onRename?.(editingPageId, nextName);
    setName("");
    closeForm();
  }

  return (
    <div
      className={`page-indicator${isFormOpen ? " is-adding" : ""}${isReordering ? " is-reordering" : ""}${onReorder ? " can-reorder" : ""}`}
      ref={rootRef}
      hidden={!indicatorPresent}
      inert={!visible}
      aria-hidden={!visible || undefined}
      onClickCapture={reorder.captureClick}
      data-reorder-page={reorder.preview?.pageId}
      data-reorder-from={reorder.preview?.from}
      data-reorder-to={reorder.preview?.to}
    >
      {onManage && <span className="page-indicator-action-slot page-indicator-manage-slot"><button
        type="button"
        className="page-indicator-action page-indicator-manage"
        ref={manageButtonRef}
        aria-label="页面设置"
        aria-haspopup="dialog"
        aria-describedby={tooltip?.anchor === manageButtonRef.current ? tooltipId : undefined}
        {...tooltipHandlers("页面设置")}
        onClick={() => {
          window.clearTimeout(tooltipTimer.current);
    setTooltip(null);
          setPageMenu(null);
          setEditingPageId(null);
          onManage();
        }}
      >
        <Controls size={12} aria-hidden="true" />
      </button></span>}
      <nav ref={capsuleRef} className="page-indicator-capsule" aria-label="首页页面" onScroll={() => { setTooltip(null); setPageMenu(null); reorder.scroll(); }}>
        {pages.map((page, index) => (
          <button
            type="button"
            className={`page-indicator-page${reorder.preview?.pageId === page.id ? " is-held" : ""}`}
            key={page.id ?? index}
            aria-label={`${page.name}页面`}
            aria-pressed={selectedIndex === index}
            aria-describedby={[onReorder && reorderHelpId, tooltip?.anchor.dataset.pageIndex === String(index) && tooltipId].filter(Boolean).join(" ") || undefined}
            aria-keyshortcuts={onReorder ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
            data-page-index={index}
            data-page-id={page.id}
            style={reorder.preview && reorder.preview.pageId !== page.id ? { transform: `translateX(${pagePreviewOffset(index, reorder.preview.from, reorder.preview.to, reorder.preview.pitch)}px)` } : undefined}
            aria-haspopup={onRename || onDelete ? "menu" : undefined}
            aria-controls={pageMenu?.id === page.id ? menuId : undefined}
            aria-expanded={pageMenu?.id === page.id}
            {...tooltipHandlers(`${page.name} (按住拖拽，右键编辑)`)}
            onPointerDown={(event) => reorder.start(event, page, index)}
            onPointerMove={reorder.move}
            onPointerUp={reorder.pointerUp}
            onLostPointerCapture={reorder.lostCapture}
            onContextMenu={(event) => openPageMenu(event, page)}
            onKeyDown={(event) => {
              if (reorder.keyboard(event, page, index)) return;
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) openPageMenu(event, page);
            }}
            onClick={() => {
              window.clearTimeout(tooltipTimer.current);
    setTooltip(null);
              setEditingPageId(null);
              setPageMenu(null);
              onSelect?.(index);
            }}
          >
            <span className="page-indicator-dot" aria-hidden="true"><span className="page-indicator-fill" /></span>
          </button>
        ))}
        {reorder.preview && <span className="page-indicator-drop-target" data-drop-index={reorder.preview.to} aria-hidden="true" style={{ left: reorder.preview.marker }} />}
      </nav>
      {onReorder && <span className="page-indicator-sr-only" id={reorderHelpId}>按住拖动可调整页面顺序，也可使用 Alt 加左右方向键；Escape 取消拖动。</span>}
      <span className="page-indicator-sr-only" role="status" aria-live="polite">{reorder.announcement}</span>

      {onAdd && <span className="page-indicator-action-slot page-indicator-add-slot"><button
        type="button"
        className="page-indicator-action page-indicator-add"
        ref={addButtonRef}
        aria-label="添加内容"
        aria-haspopup="dialog"
        aria-describedby={tooltip?.anchor === addButtonRef.current ? tooltipId : undefined}
        {...tooltipHandlers("添加快捷方式或小组件")}
        onClick={() => {
          window.clearTimeout(tooltipTimer.current);
    setTooltip(null);
          setPageMenu(null);
          setEditingPageId(null);
          onAdd();
        }}
      >
        <Plus size={12} aria-hidden="true" />
      </button></span>}

      {tooltip && !isReordering && !isFormOpen && !pageMenu && !deletingPage && (
        <div id={tooltipId} role="tooltip" className="space-tooltip page-indicator-tooltip" style={{ left: tooltip.x, maxWidth: tooltip.maxWidth }}>
          {tooltip.label}
        </div>
      )}

      {pageMenu && (
        <div ref={menuRef} id={menuId} className="page-indicator-menu home-context-menu" role="menu" aria-label="页面菜单" style={{ left: pageMenu.x }} onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const buttons = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
          const index = buttons.indexOf(document.activeElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length;
          buttons[next]?.focus();
        }}>
          {onRename && <button type="button" role="menuitem" onClick={() => {
            const target = pages.find((entry) => entry.id === pageMenu.id);
            if (target) { setName(target.name); setEditingPageId(target.id); }
            setPageMenu(null);
          }}><TextCursorInput size={16} aria-hidden="true" />编辑名称</button>}
          {onDelete && <button type="button" role="menuitem" className="is-danger" disabled={pages.length <= 1} title={pages.length <= 1 ? "至少保留一个页面" : undefined} onClick={() => { setDeletingPageId(pageMenu.id); setPageMenu(null); }}><Trash2 size={16} aria-hidden="true" />删除</button>}
        </div>
      )}

      {isFormOpen && (
        <form id={formId} className="page-indicator-form" aria-label="编辑页面名称" onSubmit={renamePage}>
          <div className="page-indicator-form-heading">
            <label htmlFor={`${formId}-name`}>页面名称</label>
            <button type="button" className="page-indicator-form-close" aria-label="关闭编辑页面名称" onClick={closeForm}>
              <X size={13} />
            </button>
          </div>
          <div className="page-indicator-form-fields">
            <input
              id={`${formId}-name`}
              ref={inputRef}
              type="text"
              placeholder="输入页面名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
              }}
            />
            <button type="submit" className="page-indicator-confirm" disabled={!name.trim()}>保存</button>
          </div>
        </form>
      )}
      {deletingPage && <BoardConfirm
        title={`删除页面“${deletingPage.name}”？`}
        description={`将移除本页的 ${deletingPage.items?.length || 0} 个项目，可在批量编辑中撤销。`}
        onClose={() => { setDeletingPageId(null); restorePageFocus(); }}
        onConfirm={() => { if (pages.length > 1) onDelete?.(deletingPage.id); setDeletingPageId(null); restorePageFocus(); }}
      />}
    </div>
  );
}

export default PageIndicator;
