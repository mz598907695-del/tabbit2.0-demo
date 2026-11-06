import { useEffect, useRef, useState } from 'react';
import './widget-ai-artwork.css';
import PreviewStack, { PreviewStackItem } from './PreviewStack';

const WIDGET_ASSETS = '/personalized-home-2-0/asset/widgets/';

/** The theme entry's shared preview stack, populated with the four original widgets. */
export default function WidgetAIArtwork({ className = '', animate = false, active = true, paused = false } = {}) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    if (!animate) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(rootRef.current);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [animate]);

  return (
    <div ref={rootRef} className={`widget-ai-artwork ${className}`.trim()} aria-hidden="true"
      data-animate={animate ? 'true' : 'false'} data-running={animate && active && visible && pageVisible ? 'true' : 'false'} data-paused={paused ? 'true' : 'false'}>
      <PreviewStack className="widget-ai-artwork-stage">
        <PreviewStackItem className="widget-ai-artwork-card widget-ai-artwork-reminder" tilt={-12}>
          <div className="widget-ai-artwork-reminder-heading">
            <img src={`${WIDGET_ASSETS}reminder.png`} alt="" draggable="false" />
            <div className="widget-ai-artwork-reminder-summary"><i /><i /></div>
          </div>
          <i className="widget-ai-artwork-reminder-line" />
          <i className="widget-ai-artwork-reminder-line" />
        </PreviewStackItem>
        <PreviewStackItem className="widget-ai-artwork-card widget-ai-artwork-joke" tilt={-4}>
          <img src={`${WIDGET_ASSETS}laughing.svg`} alt="" draggable="false" />
          <div className="widget-ai-artwork-joke-copy">
            <span>代码是程序员</span>
            <span>思维的镜子</span>
          </div>
        </PreviewStackItem>
        <PreviewStackItem className="widget-ai-artwork-card widget-ai-artwork-landscape" tilt={5}>
          <img src={`${WIDGET_ASSETS}landscape.png`} alt="" draggable="false" />
        </PreviewStackItem>
        <PreviewStackItem className="widget-ai-artwork-card widget-ai-artwork-weather" tilt={12}>
          <div className="widget-ai-artwork-weather-heading">
            <img src={`${WIDGET_ASSETS}weather.svg`} alt="" draggable="false" />
            <span>北京市<small>多云</small></span>
          </div>
          <span className="widget-ai-artwork-temperature">32<span>°</span></span>
        </PreviewStackItem>
      </PreviewStack>
    </div>
  );
}
