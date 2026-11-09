// Run checkThemeTransitions() in the desktop dev console. The isolated fixture
// uses real media and WebKit styles without changing the user's selected theme.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ThemePanel } from '/src/personalized-home-2-0/ThemePanel.jsx';
import HomeBackground, { WallpaperTransitionBackground } from '/src/personalized-home-2-0/HomeBackground.jsx';
import AIWorkspace from '/src/personalized-home-2-0/ai-workspace/AIWorkspace.jsx';
import WallpaperMedia from '/src/personalized-home-2-0/themes/WallpaperMedia.jsx';
import { useWindowWallpaperLayout } from '/src/personalized-home-2-0/themes/useWindowWallpaperLayout.js';
import { getWallpaperLayers } from '/src/windowWallpaper.ts';
import { useWallpaperSelectionTransition } from '/src/personalized-home-2-0/themes/useWallpaperSelectionTransition.js';
import { officialWallpapers, officialWallpaperIds } from '/src/personalized-home-2-0/themes/officialWallpapers.js';
import { readWallpapers } from '/src/personalized-home-2-0/themes/wallpapers.js';
import { waitForWallpaperMedia } from '/src/personalized-home-2-0/themes/wallpaper-video.js';

import { runIsolatedCheck } from './frame-check.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };

export async function checkThemeTransitions(check = 'checkThemeTransitionsInDocument') {
  if (!['checkThemeTransitionsInDocument', 'checkSharedWallpaperInDocument'].includes(check)) throw new Error('Unknown wallpaper check');
  return runIsolatedCheck('/scripts/diagnostics/theme-transitions.jsx', check);
}

export function checkSharedWallpaper() {
  return checkThemeTransitions('checkSharedWallpaperInDocument');
}

export async function checkSharedWallpaperInDocument() {
  // AIWorkspace persists demo settings. Keep this fixture's writes in memory.
  const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const storage = new Map();
  Object.defineProperty(window, 'localStorage', { configurable:true, value:{
    getItem:key => storage.get(key) ?? null, setItem:(key, value) => storage.set(key, String(value)),
    removeItem:key => storage.delete(key), key:index => [...storage.keys()][index] ?? null,
    get length() { return storage.size; },
  } });
  const fixture = document.createElement('main');
  fixture.className = 'glass-surface';
  document.body.append(fixture);
  const root = createRoot(fixture);
  let choose;
  let toggleBlur;
  const video = officialWallpapers.find(item => item.mimeType.startsWith('video/'));
  assert(video, '需要至少一个官方视频主题');
  function Fixture() {
    const [scene, setScene] = useState(video);
    const [blurred, setBlurred] = useState(false);
    const homeRef = useRef(null);
    choose = setScene;
    toggleBlur = setBlurred;
    useWindowWallpaperLayout(homeRef);
    const transition = useWallpaperSelectionTransition(scene, 'shared-fixture', null);
    return <>
      <div className="container-fill">
        {getWallpaperLayers(scene.url ? scene : null, transition).filter(layer => layer.scene.url).map(({scene, incoming, outgoing}) =>
          <div key={scene.id} className={`container-wallpaper-background${incoming ? ' is-incoming' : ''}${outgoing ? ' is-outgoing' : ''}`}>
            <div className="window-wallpaper-canvas"><WallpaperMedia src={scene.url} mimeType={scene.mimeType} posterUrl={scene.posterUrl} data-wallpaper-id={scene.id}/></div>
          </div>)}
      </div>
      <section className="personalized-home" data-theme="dark" style={{position:'absolute',left:72,top:50,right:12,bottom:12,height:'auto','--home-viewport-height':'698px'}}>
        <AIWorkspace wallpaper={scene.url ? scene : null} wallpaperTransition={transition} wallpaperBlur={blurred}>
          <div className="home-layout"><main ref={homeRef} className="home">
            <HomeBackground theme={scene.id} active paused={false}/>
            <div className="board-card" style={{position:'absolute',top:130,left:80,width:280,height:160}}>Shared wallpaper</div>
          </main></div>
        </AIWorkspace>
      </section>
    </>;
  }
  let phase = 'initial';
  const settle = async predicate => {
    const began = performance.now();
    while (!predicate()) {
      assert(performance.now() - began < 12000, `共享壁纸未就绪 ${phase}: ${JSON.stringify(players().map(v => ({id:v.dataset.wallpaperId,ready:v.readyState,paused:v.paused,rect:rect(v)})))}`);
      await wait(20);
    }
  };
  const players = () => [...fixture.querySelectorAll('video[data-wallpaper-id]')];
  const rect = media => {
    const box = media.getBoundingClientRect();
    return [box.x, box.y, box.width, box.height].map(value => Math.round(value * 100) / 100);
  };
  try {
    flushSync(() => root.render(<StrictMode><Fixture/></StrictMode>));
    await settle(() => players().length === 2 && players().every(player => player.readyState >= 2 && !player.paused));
    await Promise.all(players().map(waitForWallpaperMedia));
    assert(players().every(player => !player.hasAttribute('poster') && player.dataset.wallpaperVideoState === 'ready'), '背景仍先显示封面或没有实际视频首帧');
    const initialPlayers = players();
    const shared = fixture.querySelector('.aiw-shell > .wallpaper-background-layers video');
    assert(shared && !fixture.querySelector('.home video'), '首页仍有独立播放器');
    assert(JSON.stringify(rect(shared)) === JSON.stringify(rect(initialPlayers[0])), '内外壁纸坐标不一致');
    const originalRect = rect(shared);
    const before = shared.currentTime;
    flushSync(() => fixture.querySelector('.aiw-launcher').click());
    await wait(110);
    const navigation = fixture.querySelector('.aiw-navigation');
    assert(getComputedStyle(navigation).backdropFilter.includes('blur(8px)'), '展开过程中侧边栏没有背景模糊');
    assert(players().length === 2 && players().includes(shared), '展开侧边栏创建了额外播放器');
    await wait(300);
    assert(shared.currentTime !== before && !shared.paused, '侧边栏展开打断视频');
    assert(JSON.stringify(rect(shared)) === JSON.stringify(originalRect), '侧边栏展开移动了壁纸');
    flushSync(() => fixture.querySelector('[aria-label="收起 AI 侧边栏"]').click());
    await wait(380);
    assert(players().includes(shared) && JSON.stringify(rect(shared)) === JSON.stringify(originalRect), '侧边栏收起重建或移动了壁纸');
    flushSync(() => toggleBlur(true));
    assert(players().includes(shared) && getComputedStyle(shared.parentElement).filter === 'blur(8px)', '模糊调整重建播放器或失效');
    assert(getComputedStyle(fixture.querySelector('.board-card'), '::before').backdropFilter.includes('blur(30px)'), '卡片背景模糊失效');
    const destination = officialWallpapers.find(item => item.id !== video.id && item.mimeType.startsWith('video/'));
    phase = 'video-transition';
    flushSync(() => choose(destination));
    await settle(() => players().length === 2 && players().every(player => player.dataset.wallpaperId === destination.id));
    const colors = { id:'light', url:'', color:'transparent' };
    phase = 'color-transition';
    flushSync(() => choose(colors));
    await settle(() => players().length === 0);
    assert(initialPlayers.every(player => player.paused && !player.hasAttribute('src')), '旧播放器未释放');
    return { players:2, tabPlayers:1, homePlayers:0, sidebarReusesPlayer:true, stableLayout:true,
      sidebarBlur:'8px', cardBlur:'30px', wallpaperBlur:'8px', videoTransition:true, cleanup:true, rect:originalRect };
  } finally {
    flushSync(() => root.unmount());
    fixture.remove();
    if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor);
  }
}

export async function checkThemeTransitionsInDocument() {
  const records = await readWallpapers({ excludeIds:officialWallpaperIds });
  const urls = [];
  const url = blob => { const value = URL.createObjectURL(blob); urls.push(value); return value; };
  const wallpapers = records.map(item => ({ id:item.id, name:item.name, mimeType:item.blob.type,
    url:url(item.blob), posterUrl:item.poster ? url(item.poster) : undefined }));
  const fixture = document.createElement('section');
  fixture.className = 'personalized-home';
  fixture.style.cssText = 'position:fixed;inset:0;width:800px;height:700px;opacity:0;pointer-events:none;z-index:-1';
  fixture.inert = true;
  document.body.append(fixture);
  const root = createRoot(fixture);
  const progress = document.documentElement.style.getPropertyValue('--space-wallpaper-progress');
  const focused = document.activeElement;
  let choose;
  let changeSpace;
  const initial = { ...officialWallpapers[0], color:'transparent' };
  function Fixture() {
    const [scene, setScene] = useState(initial);
    const [spaceId, setSpaceId] = useState('diagnostic');
    choose = setScene;
    changeSpace = setSpaceId;
    const transition = useWallpaperSelectionTransition(scene, spaceId, null);
    return <>
      <div data-fixture-background style={{position:'absolute',inset:0}}>
        {[0, 1].map(index => <WallpaperTransitionBackground key={index} wallpaper={scene.url ? scene : null} transition={transition}/>)}
      </div>
      <ThemePanel theme={initial.id} themeSource="gallery" wallpaperLibrary={{wallpapers}} openThemesRequest={1}/>
    </>;
  }
  try {
    flushSync(() => root.render(<StrictMode><Fixture/></StrictMode>));
    await Promise.all([...fixture.querySelectorAll('[data-fixture-background] img')].map(image => image.decode()));
    await Promise.all([...fixture.querySelectorAll('[data-fixture-background] video')].map(waitForWallpaperMedia));
    const surfaces = () => [...fixture.querySelectorAll('[data-fixture-background] > .wallpaper-background-layers')];
    async function transitionTo(scene, nextSpace) {
      const old = surfaces().map(surface => surface.firstElementChild);
      flushSync(() => { if (nextSpace) changeSpace(nextSpace); choose(scene); });
      assert(surfaces().every((surface, index) => !old[index] || surface.contains(old[index])), `旧壁纸在新画面就绪前消失：${scene.id}`);
      const destination = [...fixture.querySelectorAll(`[data-fixture-background] [data-wallpaper-id="${scene.id}"]`)];
      const samples = [];
      const began = performance.now();
      while (surfaces().some(surface => surface.children.length > 1)) {
        assert(performance.now() - began < 12000, '壁纸过渡未完成');
        assert(surfaces().every(surface => surface.children.length <= 2), '壁纸层累积');
        for (const media of destination.filter(element => element.tagName === 'VIDEO')) {
          assert(!media.hasAttribute('poster'), '视频切换期间显示了图库封面');
          if (media.dataset.wallpaperVideoState === 'loading') assert(Number(getComputedStyle(media).opacity) < .01, '未就绪的视频过早显现');
        }
        samples.push(Number(document.documentElement.style.getPropertyValue('--space-wallpaper-progress')));
        await wait(16);
      }
      assert(samples.some(value => value > 0 && value < 1), '未出现中间透明度');
      assert(samples.every((value, index) => index === 0 || value >= samples[index - 1]), '过渡进度回退');
      assert(destination.every(media => media.isConnected), '渐变完成时重建目标媒体');
      assert(destination.filter(media => media.tagName === 'VIDEO').every(media => media.dataset.wallpaperVideoState === 'ready'), '视频画面尚未显现便移除了旧背景');
      assert(surfaces().every(surface => surface.children.length === 1), '过渡结束未清理旧壁纸');
      return { id:scene.id, frames:samples.length, intermediate:samples.filter(value => value > 0 && value < 1).length };
    }
    const transitions = [await transitionTo({ ...officialWallpapers[1], color:'transparent' })];
    const video = officialWallpapers.find(item => item.mimeType.startsWith('video/'))
      || wallpapers.find(item => item.mimeType.startsWith('video/'));
    if (video) {
      transitions.push(await transitionTo(video));
      const players = [...fixture.querySelectorAll('[data-fixture-background] video')];
      const before = players.map(player => player.currentTime);
      await wait(240);
      assert(players.length === 2 && players.every((player, index) => player.readyState >= 2
        && !player.paused && player.muted && player.volume === 0 && player.loop
        && player.currentTime !== before[index]), '视频未在外框和标签页静音循环播放');
    }
    transitions.push(await transitionTo({ id:'light', url:'', color:'transparent' }));
    transitions.push(await transitionTo(initial));
    flushSync(() => choose(officialWallpapers[2]));
    await wait(75);
    const finalScene = video || officialWallpapers[3];
    flushSync(() => choose(finalScene));
    const rapidBegan = performance.now();
    while (surfaces().some(surface => surface.children.length > 1)) {
      assert(performance.now() - rapidBegan < 12000, '连续切换未完成');
      assert(surfaces().length === 2 && surfaces().every(surface => surface.children.length <= 2), '连续切换丢失背景或累积图层');
      await wait(16);
    }
    assert(surfaces().every(surface => surface.firstElementChild.dataset.themeId === finalScene.id), '连续切换没有采用最后的选择');
    flushSync(() => { changeSpace('next-space'); choose(initial); });
    assert(surfaces().every(surface => surface.children.length === 1), '空间提交后重复播放手动主题渐变');
    transitions.push(await transitionTo({ ...officialWallpapers[1], color:'transparent' }, 'clicked-video-space'));
    const tabs = [...fixture.querySelectorAll('[role="tab"]')];
    const panels = [...fixture.querySelectorAll('.overlay-theme-browser')];
    const firstCover = panels[0].querySelector('img');
    const savedScroll = Math.min(140, panels[0].scrollHeight - panels[0].clientHeight);
    panels[0].scrollTop = savedScroll;
    flushSync(() => tabs[2].click());
    await wait(65);
    const opacities = panels.map(panel => Number(getComputedStyle(panel).opacity));
    assert(opacities[0] > 0 && opacities[0] < 1 && opacities[2] > 0 && opacities[2] < 1, '主题列表没有交叉渐变');
    assert(panels[0].inert && !panels[2].inert, '非活动列表仍可交互');
    await wait(240);
    flushSync(() => tabs[0].click());
    await wait(260);
    assert(panels.every(panel => panel.isConnected), '切分类重建列表');
    assert(panels[0].querySelector('img') === firstCover, '切分类重建封面');
    assert(panels[0].scrollTop === savedScroll, '分类滚动位置丢失');
    assert(!fixture.querySelector('.overlay-theme-browser video'), '静态封面创建了视频解码器');
    return { transitions, rapidSelection:true, spaceHandoff:true,
      gallery:{ retainedPanels:panels.length, opacities, scroll:savedScroll, staticCovers:true }, webkit:navigator.userAgent };
  } finally {
    flushSync(() => root.unmount());
    fixture.remove();
    for (const item of urls) URL.revokeObjectURL(item);
    if (progress) document.documentElement.style.setProperty('--space-wallpaper-progress', progress);
    else document.documentElement.style.removeProperty('--space-wallpaper-progress');
    focused?.focus({preventScroll:true});
  }
}
