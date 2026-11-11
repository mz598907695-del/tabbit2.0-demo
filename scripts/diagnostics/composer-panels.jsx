// Run with frame-check.js in an isolated document; no real conversations/settings are written.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Composer } from '/src/personalized-home-2-0/Composer.jsx';
import '/src/personalized-home-2-0/ai-workspace/ai-workspace.css';
import '/src/personalized-home-2-0/ai-workspace/host-workspace.css';

const wait = () => new Promise(resolve => setTimeout(resolve, 360));
const assert = (value, message) => { if (!value) throw new Error(message); };

async function checkPanels(context) {
  const fixture = document.createElement('section');
  fixture.className = 'personalized-home';
  fixture.style.cssText = 'position:absolute;inset:0;overflow:auto';
  document.body.append(fixture);
  const root = createRoot(fixture);
  flushSync(() => root.render(<div className="home-layout" style={{height:'100%'}}><main className="home" style={{height:'100%', '--home-content-top':'240px'}}>
    {context === 'home-feed' && <div className="tb-composer-scroll-glass"><span/></div>}
    <div className="home-scroll" style={{height:'100%',overflow:'auto'}}>
      <section className="home-content" style={{paddingInline:20,paddingBottom:40,minHeight:1000}}>
        {context === 'home-feed' && <button className="brand-toggle" aria-label="测试 LOGO"><span className="brand-mark brand-mark-default"/></button>}
        <div className={context} style={{position:'relative',width:760,maxWidth:'100%'}}>
          <Composer onSubmit={() => {}}/>
        </div>
      </section>
    </div>
  </main></div>));
  const host = fixture.querySelector(`.${context}`);
  const wrap = host.querySelector('.tb-composer-wrap');
  const mode = label => [...wrap.querySelectorAll('.tb-composer-modes button')].find(button => button.textContent === label);
  const switchMode = label => {
    flushSync(() => mode(label).click());
    const scope = context === 'home-feed' ? host.closest('.home-content') : wrap;
    const transitions = scope.getAnimations({subtree:true}).filter(animation =>
      'transitionProperty' in animation && animation.playState === 'running'
      && /^(height|top|bottom|transform|padding-top|margin-top|opacity|border-.*radius)$/.test(animation.transitionProperty));
    if (label === '任务') {
      assert(transitions.length === 0, `${context}: 切换任务仍有过渡 ${transitions.map(animation => animation.transitionProperty).join(', ')}`);
      assert(wrap.querySelector('.tb-composer-task-expansion').getBoundingClientRect().height >= 30, `${context}: 任务栏没有立即展开`);
    } else {
      assert(transitions.some(animation => animation.transitionProperty === 'height'), `${context}: 切回对话没有收起动画`);
      assert(transitions.some(animation => animation.transitionProperty === 'transform'), `${context}: 切回对话没有 Tab 横移动画`);
      if (context === 'home-feed') assert(transitions.some(animation => animation.transitionProperty === 'padding-top'), '切回对话没有 LOGO 位移动画');
    }
  };
  const form = () => wrap.querySelector('.tb-composer').getBoundingClientRect();
  const snapshots = [];
  try {
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.mode = theme;
      fixture.dataset.theme = theme;
      for (const width of [760, 420]) {
        host.style.width = `${width}px`;
        const initialAnchor = form().top;
        switchMode('任务');
        await wait();
        let task = wrap.querySelector('.tb-task-mount');
        assert(task && task.getBoundingClientRect().bottom <= form().top + 1, `${context}: 任务栏未挂在上方`);
        const anchor = form().top;
        assert(Math.abs(anchor - initialAnchor) < 1, `${context}: 任务行移动了输入框`);
        if (context === 'home-feed') {
          const backing = getComputedStyle(wrap.querySelector('.tb-composer-frame'), '::before');
          const backingTop = wrap.querySelector('.tb-composer-frame').getBoundingClientRect().top + parseFloat(backing.top);
          assert(fixture.querySelector('.brand-toggle').getBoundingClientRect().bottom <= backingTop, '首页任务栏遮挡 LOGO');
        }
        assert(getComputedStyle(task).paddingLeft === '0px' && getComputedStyle(task).paddingRight === '0px', `${context}: 行容器仍有左右内边距`);
        for (const button of task.querySelectorAll('.tb-task-project, .tb-task-runtime')) {
          const style = getComputedStyle(button), icon = button.querySelector('svg').getBoundingClientRect();
          assert(button.getBoundingClientRect().height === 24 && parseFloat(style.fontSize) === 12, `${context}: 按钮高度或字号错误`);
          assert(parseFloat(style.gap) === 4 && parseFloat(style.paddingLeft) === 6 && parseFloat(style.paddingRight) === 6, `${context}: 按钮间距错误`);
          assert(icon.width === 14 && icon.height === 14, `${context}: 图标尺寸错误`);
          assert(Math.abs(form().top - button.getBoundingClientRect().bottom - 6) < 1, `${context}: 任务栏与输入框间距不是 6px`);
        }
        for (const [kind, selector] of [
          ['add', '.tb-composer-plus'], ['ideas', '.tb-composer-ideas'], ['model', '.tb-model-trigger'],
        ]) {
          wrap.querySelector(selector).click();
          await wait();
          const panel = wrap.querySelector(`.tb-composer-inline-${kind}`);
          assert(panel, `${context}: ${kind} 未展开`);
          if (kind === 'model') {
            const trigger = wrap.querySelector('.tb-model-trigger'), style = getComputedStyle(trigger);
            const arrow = new DOMMatrixReadOnly(getComputedStyle(trigger.querySelector('svg')).transform);
            assert(style.paddingLeft === '8px' && style.paddingRight === '6px', '模型按钮内边距错误');
            assert(Math.abs(arrow.a + 1) < .01 && Math.abs(arrow.d + 1) < .01, '模型展开时箭头未朝上');
          }
          assert(wrap.querySelector('.tb-task-mount') === task && !task.closest('[inert]'), `${context}: ${kind} 替换或禁用了任务栏`);
          // Tall menus scroll inside the expansion; test its visible bounds.
          const bounds = panel.closest('.tb-composer-expansion').getBoundingClientRect();
          assert(bounds.height > 32, `${context}: ${kind} 展开高度不足`);
          assert(context === 'home-feed' ? bounds.top >= form().bottom - 1 : bounds.bottom <= task.getBoundingClientRect().top + 1,
            `${context}: ${kind} 展开方向错误或与任务栏重叠 ${JSON.stringify({panelTop:bounds.top,panelBottom:bounds.bottom,taskTop:task.getBoundingClientRect().top,formTop:form().top,position:getComputedStyle(panel.parentElement.parentElement).position,bottom:getComputedStyle(panel.parentElement.parentElement).bottom})}`);
          assert(Math.abs(form().top - anchor) < 1, `${context}: ${kind} 移动了输入框`);
          switchMode('对话');
          await wait();
          assert(wrap.querySelector(`.tb-composer-inline-${kind}`) === panel && !panel.closest('[inert]'), `${context}: 切换对话收起或重建了 ${kind}`);
          assert(wrap.querySelector('.tb-composer-task-expansion').getBoundingClientRect().height < 1, `${context}: 对话模式任务栏未收起`);
          const dialogRadius = getComputedStyle(wrap.querySelector('.tb-composer-frame'), '::before').borderTopLeftRadius;
          assert(Math.abs(parseFloat(dialogRadius) - 30) < .1, `${context}: 对话模式顶部圆角被修改 (${dialogRadius}, expansion=${wrap.dataset.expansion}, task=${wrap.dataset.taskMode})`);
          switchMode('任务');
          await wait();
          task = wrap.querySelector('.tb-task-mount');
          assert(wrap.querySelector(`.tb-composer-inline-${kind}`) === panel && !panel.closest('[inert]'), `${context}: 切换任务收起或重建了 ${kind}`);
          assert(task && task.getBoundingClientRect().bottom <= form().top + 1, `${context}: 切换任务后挂载位置错误`);
          const visiblePanel = panel.closest('.tb-composer-expansion').getBoundingClientRect();
          assert(context === 'home-feed' ? visiblePanel.top >= form().bottom - 1 : visiblePanel.bottom <= task.getBoundingClientRect().top + 1, `${context}: 保留面板时与任务栏重叠`);
          snapshots.push({context, theme, width, panel:kind, side:context === 'home-feed' ? 'bottom' : 'top'});
          panel.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
          await wait();
          const inline = wrap.querySelector('.tb-composer-expansion:not(.tb-composer-task-expansion)');
          assert(inline.getBoundingClientRect().height < 1, `${context}: ${kind} 关闭后仍占空间`);
          assert(task.getBoundingClientRect().height >= 30 && !task.closest('[inert]'), `${context}: 关闭 ${kind} 时任务栏消失`);
          const backing = getComputedStyle(wrap.querySelector('.tb-composer-frame'), '::before');
          const extension = task.getBoundingClientRect().height;
          assert(Math.abs(parseFloat(backing.top) + extension + 6) < 1, `${context}: 关闭后外框残留面板高度`);
          assert(Math.abs(parseFloat(backing.borderTopLeftRadius) - 16) < .1 && Math.abs(parseFloat(backing.borderBottomLeftRadius) - 30) < .1, `${context}: 外框圆角错误`);
        }
        switchMode('对话');
        await wait();
        assert(wrap.querySelector('.tb-composer-task-expansion').getBoundingClientRect().height < 1, `${context}: 对话模式任务栏未收起`);
      }
    }
    return {passed:true, scenarios:snapshots};
  } finally {
    root.unmount();
    fixture.remove();
  }
}

export const checkHomePanels = () => checkPanels('home-feed');
export const checkConversationPanels = () => checkPanels('aiw-conversation-footer');
export const checkWidgetPanels = () => checkPanels('widget-ai-chat-compose');

export async function checkSidebarEntry() {
  const fixture = document.createElement('section');
  fixture.className = 'personalized-home';
  fixture.style.cssText = 'position:absolute;inset:0';
  document.body.append(fixture);
  const root = createRoot(fixture);
  flushSync(() => root.render(<div className="aiw-shell" style={{height:300}}>
    <div className="aiw-nav-host"/>
    <div className="aiw-stage"><header className="aiw-stage-topbar"><button className="aiw-launcher" aria-label="展开侧边栏"/><h1 className="aiw-stage-title">标题</h1></header></div>
  </div>));
  const shell = fixture.querySelector('.aiw-shell');
  const scenarios = [];
  try {
    for (const content of [false, true]) {
      shell.classList.toggle('has-content', content);
      await wait();
      const stage = shell.querySelector('.aiw-stage').getBoundingClientRect();
      const launcher = shell.querySelector('.aiw-launcher').getBoundingClientRect();
      assert(launcher.left - stage.left === 8 && launcher.top - stage.top === 8, '侧边栏入口没有对齐到左上 8px');
      assert(shell.querySelector('.aiw-stage-topbar').getBoundingClientRect().height === 48, '标题栏高度不是 48px');
      scenarios.push({context:'sidebar-entry', content, left:launcher.left-stage.left, top:launcher.top-stage.top});
    }
    shell.classList.add('is-open');
    await wait();
    assert(shell.querySelector('.aiw-stage-title').getBoundingClientRect().left - shell.querySelector('.aiw-stage').getBoundingClientRect().left === 12, '标题左内边距不是 12px');
    return {passed:true, scenarios};
  } finally { root.unmount(); fixture.remove(); }
}
