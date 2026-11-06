import { useLayoutEffect, useRef, useState } from 'react';

// Keep the element mounted through its exit, so visibility never cuts off motion.
export function useVisibilityMotion(ref, visible, offset) {
  const [present, setPresent] = useState(visible);
  const previous = useRef(visible);
  useLayoutEffect(() => {
    if (visible && !present) { setPresent(true); return; }
    if (!present || (previous.current === visible && present === visible)) return;
    previous.current = visible;
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPresent(visible);
      return;
    }
    const away = { opacity: 0, translate: `0 ${offset}px` };
    const shown = { opacity: 1, translate: '0 0' };
    const animation = node.animate(visible ? [away, shown] : [shown, away], {
      duration: 300, easing: 'cubic-bezier(.2, 0, 0, 1)', fill: 'both',
    });
    animation.onfinish = () => {
      if (!visible) setPresent(false);
      else animation.cancel();
    };
    return () => { animation.onfinish = null; animation.cancel(); };
  }, [ref, visible, present, offset]);
  return present;
}
