export const DOCK_TOP = 16;
export const DOCK_HEIGHT = 56;

const clamp = value => Math.max(0, Math.min(1, value));

// The origin is the feed's normal-flow top, never the sticky element's position.
export function composerScrollProgress(scrollTop, origin, reducedMotion = false) {
  const end = Math.max(1, origin - DOCK_TOP);
  const travel = Math.min(160, end);
  const linear = clamp((scrollTop - (end - travel)) / travel);
  if (reducedMotion) return linear >= .5 ? 1 : 0;
  return linear * linear * (3 - 2 * linear);
}

export function followScrollProgress(current, target, elapsed) {
  if (Math.abs(current - target) < .001) return target;
  return current + (target - current) * (1 - Math.exp(-Math.min(48, elapsed) / 65));
}

// All dimensions are measured together when layout changes. During scrolling,
// reproduce CSS sticky positioning from the scroll offset without reading DOM
// rectangles after the previous frame's animated styles.
export function composerScrollFrame(geometry, scrollTop, progress, glassProgress, { target = progress, glassTarget = glassProgress } = {}) {
  const { origin, feedHeight, wrapperHeight, canvasInset, formOffset, height } = geometry;
  const stickyTop = Math.min(
    Math.max(origin - scrollTop, DOCK_TOP),
    origin + feedHeight - wrapperHeight - scrollTop,
  );
  const formTop = canvasInset + stickyTop + formOffset;
  const surfaceHeight = height + (DOCK_HEIGHT - height) * progress;
  return {
    progress,
    formTop,
    surfaceHeight,
    secondary: Math.max(0, 1 - progress / .45),
    glassStrength: Math.max(0, (glassProgress - .25) / .75),
    glassEdge: formTop + surfaceHeight,
    // Intermediate scroll positions can be fully settled. Share the RAF stop
    // condition so pointer highlights resume on the last settling frame too.
    animating: Math.abs(progress - target) > .0001 || Math.abs(glassProgress - glassTarget) > .0001,
  };
}

// This renderer only writes. Keeping the last applied values also makes steady
// scroll/focus notifications free of style invalidation and menu repositioning.
export function createComposerScrollRenderer(root, glass) {
  const applied = new WeakMap();
  let previousGeometry = [];
  function write(node, kind, name, value) {
    let values = applied.get(node);
    if (!values) { values = new Map(); applied.set(node, values); }
    const key = `${kind}:${name}`;
    if (values.get(key) === value) return;
    values.set(key, value);
    if (kind === 'style') node.style.setProperty(name, value);
    else node.dataset[name] = value;
  }
  return (geometry, frame, { editing, overlayOpen }) => {
    const style = (node, name, value) => write(node, 'style', name, String(value));
    const data = (node, name, value) => write(node, 'data', name, String(value));
    style(root, '--dock-expanded-height', `${geometry.height}px`);
    style(root, '--dock-input-shift', `${geometry.inputShift}px`);
    style(root, '--dock-toolbar-shift', `${geometry.toolbarShift}px`);
    style(root, '--dock-end-width', `${geometry.endWidth}px`);
    style(glass, '--dock-glass-base-edge', `${geometry.baseGlassEdge}px`);
    style(root, '--dock-progress', frame.progress);
    style(root, '--dock-secondary-opacity', frame.secondary);
    style(root, '--dock-surface-height', `${frame.surfaceHeight}px`);
    style(glass, '--dock-glass-opacity', frame.glassStrength);
    style(glass, '--dock-glass-edge', `${frame.glassEdge}px`);
    data(root, 'docked', frame.progress > .995);
    data(root, 'editing', editing);
    data(root, 'dockAnimating', frame.animating);
    data(glass, 'glassVisible', frame.glassStrength > 0);

    // The glass fade does not move controls. Only notify an existing overlay
    // when its anchor can move/resize, including expanded-form layout changes.
    const currentGeometry = [frame.progress, frame.formTop, geometry.formWidth,
      geometry.height, geometry.inputShift, geometry.toolbarShift, geometry.endWidth];
    const changed = currentGeometry.some((value, index) => value !== previousGeometry[index]);
    previousGeometry = currentGeometry;
    if (overlayOpen && changed) root.dispatchEvent(new Event('composergeometrychange'));
  };
}
