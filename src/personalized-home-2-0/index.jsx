import { useLayoutEffect, useRef } from 'react';
import { App } from './App';
import './styles.css';
import './themes/liquid-glass.css';
import './themes/liquid-glass-library.css';
import './themes/liquid-glass-macos.css';
import './themes/wallpaper-contrast.css';
import './themes/liquid-glass-performance.css';
import './host.css';
import './styles/home-surfaces.css';

export default function PersonalizedHome({ hostActive = true } = {}) {
  const root = useRef(null);
  useLayoutEffect(() => {
    const element = root.current;
    let width = -1, height = -1;
    const resize = () => {
      const nextHeight = element.clientHeight, nextWidth = element.clientWidth;
      if (height !== nextHeight) element.style.setProperty('--home-viewport-height', `${nextHeight}px`);
      if (width !== nextWidth) element.style.setProperty('--home-viewport-width', `${nextWidth}px`);
      height = nextHeight; width = nextWidth;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section ref={root} className="new-tab-page personalized-home"><App hostActive={hostActive}/></section>;
}
