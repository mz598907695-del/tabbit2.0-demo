import { useLayoutEffect, useState } from 'react';
import { readWindowAppearance, watchExistingTokenMode, WINDOW_APPEARANCE_KEY } from '../../../windowAppearance';
import WorkspaceBookmarksPage from './WorkspaceBookmarksPage';
import '../../styles/base.css';

export default function StandaloneBookmarksPage() {
  const [appearance, setAppearance] = useState(readWindowAppearance);
  const [theme, setTheme] = useState(document.documentElement.dataset.mode || 'light');
  useLayoutEffect(() => watchExistingTokenMode(appearance, setTheme), [appearance]);
  useLayoutEffect(() => {
    document.title = '收藏 · Tabbit';
    const sync = event => { if (event.key === WINDOW_APPEARANCE_KEY) setAppearance(readWindowAppearance()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <section className="personalized-home bookmark-standalone" data-theme={theme}><WorkspaceBookmarksPage/></section>;
}
