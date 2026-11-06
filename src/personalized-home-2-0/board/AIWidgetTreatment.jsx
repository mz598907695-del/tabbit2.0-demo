import { useEffect, useRef, useState } from 'react';
import './ai-widget-treatment.css';

export function AIWidgetTreatmentCard({ hidden, active, onFocusChange, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(ref.current);
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  function changeFocus(value) {
    setFocused(value);
    onFocusChange?.(value);
  }

  return <article ref={ref} hidden={hidden} className="board-library-card board-library-ai-card ai-treatment-card" aria-label="AI 生成小组件" data-library-kind="ai" data-animating={active && !hidden && visible && pageVisible && !focused ? 'true' : 'false'}
    onFocusCapture={() => changeFocus(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) changeFocus(false); }}>
    <span className="ai-treatment-border" aria-hidden="true" />
    {children}
  </article>;
}
