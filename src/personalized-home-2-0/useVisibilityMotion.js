import { useLayoutEffect, useRef, useState } from 'react';

// Keep the element mounted through its exit, so visibility never cuts off motion.
export function useVisibilityMotion(ref, visible, offset, { fade = true } = {}) {
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
    // A translucent ancestor becomes a backdrop root. Material surfaces must
    // keep their wallpaper backdrop throughout the motion, including its end.
    const away = { ...(fade ? { opacity: 0 } : {}), translate: `0 ${offset}px` };
    const shown = { ...(fade ? { opacity: 1 } : {}), translate: '0 0' };
    const animation = node.animate(visible ? [away, shown] : [shown, away], {
      duration: 300, easing: 'cubic-bezier(.2, 0, 0, 1)', fill: 'both',
    });
    animation.onfinish = () => {
      if (!visible) setPresent(false);
      else animation.cancel();
    };
    return () => { animation.onfinish = null; animation.cancel(); };
  }, [ref, visible, present, offset, fade]);
  return present;
}
