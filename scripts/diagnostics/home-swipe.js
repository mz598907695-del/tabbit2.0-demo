// Development-console check, not imported by the product. Run with the home
// visible and no dialog open. It restores the selected page in finally.
export async function checkHomeSwipe({ cycles = 1 } = {}) {
  const board = document.querySelector('.workspace-board');
  const buttons = [...document.querySelectorAll('.page-indicator-page')];
  if (!board?.clientWidth || buttons.length < 2) throw new Error('请先打开首页并关闭弹窗');
  const current = () => buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true');
  const original = current();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const requestFrame = window.requestAnimationFrame;
  let idleFrameRequests = 0, sampling = false;
  const times = [], opacityViolations = [], blurValues = new Set();
  let last;

  function sample(time) {
    if (!sampling) return;
    if (last !== undefined) times.push(time - last);
    last = time;
    const grid = board.querySelector(':scope > .board-grid');
    const peer = board.querySelector('.board-page-preview');
    for (const node of [grid, peer]) {
      const opacity = getComputedStyle(node).opacity;
      if (opacity !== '1') opacityViolations.push(opacity);
    }
    const surface = grid.querySelector('.board-card');
    if (surface) blurValues.add(getComputedStyle(surface, '::before').backdropFilter);
    requestAnimationFrame(sample);
  }
  async function swipe(direction, distance) {
    window.dispatchEvent(new CustomEvent('tabbit-trackpad-phase', { detail: 'began' }));
    for (let moved = 0; moved < distance; moved += 20) {
      board.dispatchEvent(new WheelEvent('wheel', {
        deltaX: direction * Math.min(20, distance - moved), deltaY: 0,
        deltaMode: 0, bubbles: true, cancelable: true,
      }));
      await nextFrame();
    }
    window.dispatchEvent(new CustomEvent('tabbit-trackpad-phase', { detail: 'ended' }));
    await sleep(450);
  }
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    buttons[0].click();
    await sleep(600);
    window.requestAnimationFrame = callback => { idleFrameRequests++; return requestFrame.call(window, callback); };
    await sleep(1000);
    window.requestAnimationFrame = requestFrame;
    sampling = true;
    requestAnimationFrame(sample);
    await swipe(1, 60);
    require(current() === 0, '短距离取消后页码发生变化');
    for (let cycle = 0; cycle < Math.max(1, Math.min(5, cycles)); cycle++) {
      await swipe(1, board.clientWidth * .65);
      require(current() === 1, '向前切页失败');
      await swipe(-1, board.clientWidth * .65);
      require(current() === 0, '反向切页失败');
    }
    sampling = false;
    require(opacityViolations.length === 0, '卡片祖先在切页时出现透明度变化');
    const outgoingNodes = board.querySelector('.board-page-outgoing').childElementCount;
    const previewNodes = board.querySelector('.board-page-preview').childElementCount;
    require(outgoingNodes === 0 && previewNodes === 0, '切页后残留过渡 DOM');
    const sorted = times.sort((a, b) => a - b);
    return {
      url: location.href, userAgent: navigator.userAgent, cycles,
      frames: sorted.length, p95Ms: sorted[Math.floor(sorted.length * .95)],
      maxMs: Math.max(...sorted), longFrames: sorted.filter(time => time > 34).length,
      idleFrameRequests, opacityViolations: opacityViolations.length,
      blurValues: [...blurValues], outgoingNodes, previewNodes,
    };
  } finally {
    sampling = false;
    window.requestAnimationFrame = requestFrame;
    buttons[original]?.click();
    await sleep(350);
  }
}
