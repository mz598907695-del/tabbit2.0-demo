import { useEffect, useId, useRef } from 'react';
import { ArrowLeft } from "./icons";
import Composer from './Composer';
import WidgetAIArtwork from './WidgetAIArtwork';
import { WIDGET_SKILL, WIDGET_PROMPT } from './widget-ai-data';
import './widget-ai-chat.css';

export default function WidgetAIChat({ onBack, onSubmit, onVoice, onOverlayChange, active = true, initialDraft, composerRef: providedComposerRef }) {
  const headingId = useId();
  const localComposerRef = useRef(null);
  const focusedOnce = useRef(false);
  const composerRef = providedComposerRef || localComposerRef;

  useEffect(() => {
    if (!active) { composerRef.current?.closeOverlays(); return; }
    // Focus after the library has closed and restored its previous opener.
    const frame = requestAnimationFrame(() => {
      composerRef.current?.focus({ atEnd: !focusedOnce.current });
      focusedOnce.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [active, composerRef]);

  function returnHome() {
    composerRef.current?.closeOverlays();
    onBack?.();
  }

  return (
    <main className="widget-ai-chat" aria-label="AI 对话">
      <header className="widget-ai-chat-header">
        <button type="button" className="widget-ai-chat-back" onClick={returnHome}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>返回首页</span>
        </button>
        <span className="widget-ai-chat-label">AI 对话</span>
      </header>
      <section className="widget-ai-chat-content" aria-labelledby={headingId}>
        <div className="widget-ai-chat-compose">
          <WidgetAIArtwork />
          <h1 id={headingId}>个性化你的首页</h1>
          <Composer
            ref={composerRef}
            initialSkill={WIDGET_SKILL}
            initialQuery={WIDGET_PROMPT}
            initialDraft={initialDraft}
            simple
            onSubmit={onSubmit}
            onVoice={onVoice}
            onOverlayChange={onOverlayChange}
          />
        </div>
      </section>
    </main>
  );
}
