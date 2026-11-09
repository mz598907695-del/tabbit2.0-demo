import { useEffect, useRef, useState } from "react";
import { X } from "./icons";
import "./promotion-carousel.css";
import { createPromotionClock } from "./promotion-clock";

export function PromotionCarousel({ items = [], onAction, onClose, paused = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRef = useRef(null);
  const progressRefs = useRef([]);
  const clockRef = useRef(null);
  const externalPausedRef = useRef(paused);
  externalPausedRef.current = paused;

  useEffect(() => {
    if (!items.length) return undefined;
    setActiveIndex(0);
    let paintedIndex = -1;
    progressRefs.current.forEach((element) => {
      if (element) element.style.transform = "translateX(-100%)";
    });
    const clock = createPromotionClock({
      count: items.length,
      onIndexChange: setActiveIndex,
      onProgress(index, fraction) {
        if (paintedIndex !== index && progressRefs.current[paintedIndex]) {
          progressRefs.current[paintedIndex].style.transform = "translateX(-100%)";
        }
        const element = progressRefs.current[index];
        if (element) element.style.transform = `translateX(${(fraction - 1) * 100}%)`;
        paintedIndex = index;
      },
    });
    clockRef.current = clock;
    clock.setPaused("external", externalPausedRef.current);
    clock.setPaused("document", document.hidden);
    clock.setPaused("hover", window.matchMedia("(hover: hover)").matches && (cardRef.current?.matches(":hover") ?? false));
    clock.setPaused("focus", Boolean(cardRef.current?.contains(document.activeElement) && document.activeElement?.matches(":focus-visible")));
    function onVisibilityChange() {
      clock.setPaused("document", document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    clock.start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clock.dispose();
      if (clockRef.current === clock) clockRef.current = null;
    };
  }, [items.length]);

  useEffect(() => {
    clockRef.current?.setPaused("external", paused);
  }, [paused]);

  const visibleIndex = activeIndex < items.length ? activeIndex : 0;
  const item = items[visibleIndex];
  if (!item) return null;

  return (
    <article
      ref={cardRef}
      className="promotion-card promotion-carousel"
      aria-label="推荐活动"
      aria-roledescription="轮播"
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") clockRef.current?.setPaused("hover", true);
      }}
      onPointerLeave={() => clockRef.current?.setPaused("hover", false)}
      onFocusCapture={(event) => clockRef.current?.setPaused("focus", event.target.matches(":focus-visible"))}
      onKeyDownCapture={() => clockRef.current?.setPaused("focus", true)}
      onPointerDownCapture={() => clockRef.current?.setPaused("focus", false)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          clockRef.current?.setPaused("focus", false);
        }
      }}
    >
      <div className="promotion-art">
        {items.map((slide, index) => (
          <img
            className={`promotion-carousel-image ${index === visibleIndex ? "is-active" : ""}`}
            key={`${index}-${slide.image}`}
            src={slide.image}
            alt={index === visibleIndex ? slide.alt || slide.title : ""}
            aria-hidden={index !== visibleIndex}
            draggable="false"
          />
        ))}
        <button
          type="button"
          className="promotion-close"
          aria-label="关闭活动卡片"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <div className="promotion-pages" role="group" aria-label="活动轮播">
          {items.map((slide, index) => (
            <button
              type="button"
              key={index}
              aria-label={`活动 ${index + 1}：${slide.title}`}
              aria-pressed={index === visibleIndex}
              className={index === visibleIndex ? "active" : ""}
              onClick={() => clockRef.current?.select(index)}
            >
              <span className="promotion-progress-track" aria-hidden="true">
                <span
                  className="promotion-progress-fill"
                  ref={(element) => { progressRefs.current[index] = element; }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="promotion-copy" aria-live="off">
        <div>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        <button type="button" className="primary-button" onClick={() => onAction?.(item)}>
          {item.action}
        </button>
      </div>
    </article>
  );
}

export default PromotionCarousel;
