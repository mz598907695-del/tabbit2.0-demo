import { useEffect, useSyncExternalStore } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { createUpdateController } from './update-controller';
import './auto-update.css';

const updater = createUpdateController({ check, relaunch });
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

export default function AutoUpdate() {
  const state = useSyncExternalStore(updater.subscribe, updater.getSnapshot);
  useEffect(() => {
    if (!isTauri()) return;
    const manual = () => { void updater.checkForUpdates({ manual:true }); };
    window.addEventListener('tabbit-check-for-updates', manual);
    if (import.meta.env.DEV) return () => window.removeEventListener('tabbit-check-for-updates', manual);
    let lastCheck = 0;
    const automatic = () => {
      if (!navigator.onLine || document.hidden || Date.now() - lastCheck < CHECK_INTERVAL) return;
      lastCheck = Date.now();
      void updater.checkForUpdates();
    };
    const start = window.setTimeout(automatic, 15000);
    const interval = window.setInterval(automatic, CHECK_INTERVAL);
    window.addEventListener('online', automatic);
    document.addEventListener('visibilitychange', automatic);
    return () => {
      window.clearTimeout(start); window.clearInterval(interval);
      window.removeEventListener('online', automatic);
      document.removeEventListener('visibilitychange', automatic);
      window.removeEventListener('tabbit-check-for-updates', manual);
    };
  }, []);
  useEffect(() => {
    if (!state.visible || !['current','error'].includes(state.phase)) return;
    const timer = window.setTimeout(updater.dismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [state.visible, state.phase]);
  if (!state.visible || !isTauri()) return null;
  const progress = state.total ? Math.min(100, Math.floor(state.received / state.total * 100)) : null;
  const title = state.phase === 'checking' ? '正在检查更新'
    : state.phase === 'downloading' ? `正在下载新版本 ${state.version}`
    : state.phase === 'ready' ? `新版本 ${state.version} 已就绪`
    : state.phase === 'installing' ? '正在安装更新'
    : state.phase === 'installed' ? '更新已安装'
    : state.phase === 'current' ? '已经是最新版本'
    : state.error === 'download' ? '更新下载失败' : '暂时无法检查更新';
  const description = state.error === 'install' ? '安装未完成，可以重试。'
    : state.phase === 'ready' ? '重启后即可使用，空间和个人设置将保留。'
    : state.phase === 'downloading' ? progress === null ? '正在后台下载，可以继续使用。' : `已下载 ${progress}%，可以继续使用。`
    : state.phase === 'installed' ? '点击重新启动，使用新版本。'
    : state.phase === 'error' ? '请检查网络，稍后再试。' : '';
  return <aside className="app-update-notice" aria-label="应用更新">
    <div className="app-update-copy" role="status" aria-live="polite"><strong>{title}</strong>{description && <p>{description}</p>}</div>
    {state.phase === 'downloading' && <progress aria-label="更新下载进度" max={100} value={progress ?? undefined}/>}
    {state.phase !== 'installing' && <div className="app-update-actions">
      <button type="button" onClick={updater.dismiss}>{state.phase === 'ready' || state.phase === 'installed' ? '稍后' : '关闭'}</button>
      {state.phase === 'ready' && <button type="button" className="is-primary" onClick={() => void updater.installUpdate()}>重启更新</button>}
      {state.phase === 'installed' && <button type="button" className="is-primary" onClick={() => void updater.restart()}>重新启动</button>}
      {state.phase === 'error' && <button type="button" className="is-primary" onClick={() => void updater.checkForUpdates({ manual:true })}>重试</button>}
    </div>}
  </aside>;
}
