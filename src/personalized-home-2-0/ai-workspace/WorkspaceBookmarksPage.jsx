import { useEffect, useState } from 'react';
import WorkspaceContent from './WorkspaceContent';
import { readWorkspaceData } from './workspace-data';
import { resolvePreferences } from '../preferences';
import './ai-workspace.css';

// The standalone demo shares the same local collection, without mounting a
// second homepage or replacing the source tab's current content and draft.
export default function WorkspaceBookmarksPage() {
  const [data, setData] = useState(readWorkspaceData);
  useEffect(() => {
    document.title = '收藏 · Tabbit';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('personalized-home-2-0-preferences') || '{}'); } catch { /* Default appearance. */ }
      const { appearance } = resolvePreferences(saved, systemTheme.matches);
      document.documentElement.dataset.theme = appearance === 'dark' || (appearance === 'system' && systemTheme.matches) ? 'dark' : 'light';
    };
    syncTheme();
    const sync = event => {
      if (event.key === 'personalized-home-2-0-ai-workspace-demo-v1') setData(readWorkspaceData());
      if (event.key === 'personalized-home-2-0-preferences') syncTheme();
    };
    window.addEventListener('storage', sync);
    systemTheme.addEventListener('change', syncTheme);
    return () => {
      window.removeEventListener('storage', sync);
      systemTheme.removeEventListener('change', syncTheme);
    };
  }, []);

  function updateData(update) {
    // Read at the time of the edit, so another tab's changes are retained.
    let current = data;
    try { if (localStorage.getItem('personalized-home-2-0-ai-workspace-demo-v1')) current = readWorkspaceData(); } catch { /* Keep session data. */ }
    const next = typeof update === 'function' ? update(current) : update;
    try { localStorage.setItem('personalized-home-2-0-ai-workspace-demo-v1', JSON.stringify(next)); } catch { /* Session-only fallback. */ }
    setData(next);
  }

  return <div className="aiw-shell has-content">
    <main className="aiw-page-host" aria-label="收藏管理">
      <WorkspaceContent page="bookmarks" data={data} setData={updateData}/>
    </main>
    <header className="aiw-stage-topbar" aria-label="顶部栏"/>
  </div>;
}
