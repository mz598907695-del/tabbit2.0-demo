import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/semantic.css';
import './iconfont.css';
import './personalized-home-2-0/ai-workspace/bookmarks/bookmark-entry.css';
import StandaloneBookmarksPage from './personalized-home-2-0/ai-workspace/bookmarks/StandaloneBookmarksPage';
import { applyExistingTokenMode, readWindowAppearance } from './windowAppearance';

applyExistingTokenMode(readWindowAppearance());
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><StandaloneBookmarksPage/></React.StrictMode>,
);
