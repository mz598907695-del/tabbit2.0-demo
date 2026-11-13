import { Download, FileText, Puzzle } from 'lucide-react';
import './browser-extensions.css';

/** Compact pinned-extension strip beside the browser's account controls. */
export default function BrowserExtensions() {
  return <div className="toolbar-extensions" role="group" aria-label="插件与下载">
    <button type="button" className="toolbar-icon-button" aria-label="网页笔记" title="网页笔记">
      <span className="toolbar-extension-note" aria-hidden="true"><FileText/></span>
    </button>
    <button type="button" className="toolbar-icon-button" aria-label="Obsidian Web Clipper" title="Obsidian Web Clipper">
      <svg className="toolbar-extension-crystal" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m14.3 1.7 5 6.1-1.1 5.3 2.4 6.2-6.8 3-9.4-3.1 2.1-7.4L10 8l1.3-5.1z" fill="#9970f5"/>
        <path d="M14.3 1.7 12 10.1l6.2 3 1.1-5.3z" fill="#c4a1ff"/>
        <path d="m12 10.1 1.8 12.2-9.4-3.1 2.1-7.4L10 8z" fill="#7950d5"/>
        <path d="m12 10.1 6.2 3 2.4 6.2-6.8 3z" fill="#a984fa"/>
        <path d="m6.5 11.8 3.9 3.7 3.4 6.8-9.4-3.1z" fill="#b993ff"/>
      </svg>
    </button>
    <button type="button" className="toolbar-icon-button" aria-label="下载内容" title="下载内容"><Download aria-hidden="true"/></button>
    <button type="button" className="toolbar-icon-button" aria-label="扩展程序" title="扩展程序"><Puzzle aria-hidden="true"/></button>
  </div>;
}
