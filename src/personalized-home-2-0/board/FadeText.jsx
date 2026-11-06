import { useLayoutEffect, useRef, useState } from 'react';

/** Keep complete accessible text, fading only when the available line is too short. */
export default function FadeText({ children, className = '' }) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    const measure = () => setOverflow(node.scrollWidth > node.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [children]);
  return <p className={`board-fade-line ${overflow ? 'is-overflowing' : ''} ${className}`} title={overflow ? String(children) : undefined}><span ref={ref}>{children}</span></p>;
}
