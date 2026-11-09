import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "./icons";
import { createPromotionClock } from "./promotion-clock";
import "./promotion-inline-carousel.css";

const initialSlide = (count) => count > 1 ? 1 : 0;
const ORBIT_DURATION = 400;
const PERSPECTIVE = 360;
const EASE_MOVE = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_TEXT = "cubic-bezier(0.25, 0.1, 0.25, 1)";
const slots = [
  { x: 0, z: 0, size: 44, opacity: 1, zIndex: 3 },
  { x: 0, z: 0, size: 44, opacity: 0, zIndex: 2 },
  { x: 0, z: 0, size: 44, opacity: 0, zIndex: 1 },
];
const segmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("zh", { granularity: "grapheme" }) : null;
const characters = (text = "") => segmenter
  ? Array.from(segmenter.segment(text), (entry) => entry.segment) : Array.from(text);

function orbFrame({ x, y = 0, z = 0, size, opacity, zIndex }) {
  // Compensate perspective at rest: visible artwork heights remain exactly 44/36/28.
  // Keep even the rear orbit in front of the parent's pointer hit-test plane.
  const stageZ = z + 52;
  const depth = 1 - stageZ / PERSPECTIVE;
  return {
    transform: `translate3d(${x * depth}px, ${y * depth}px, ${stageZ}px) scale(${size / 44 * depth})`,
    opacity,
    zIndex,
  };
}

function slotFrame(position) {
  const slot = slots[Math.min(position, slots.length - 1)];
  return orbFrame(position > 2 ? { ...slot, opacity: 0, zIndex: 0 } : slot);
}

function readOrb(element) {
  const style = getComputedStyle(element);
  const matrix = new DOMMatrixReadOnly(style.transform);
  const depth = 1 - matrix.m43 / PERSPECTIVE;
  return {
    x: matrix.m41 / depth,
    y: matrix.m42 / depth,
    z: matrix.m43 - 52,
    size: matrix.m11 / depth * 44,
    opacity: Number(style.opacity),
  };
}

function orbTrajectory(start, previousPosition, position) {
  const target = slots[Math.min(position, slots.length - 1)];
  const end = position > 2 ? { ...target, opacity: 0, zIndex: 0 } : target;
  // Adapt the lift-and-settle of Aceternity Animated Testimonials to compact artwork.
  // One continuous curve and one easing: no independent acceleration at waypoints.
  const departing = previousPosition === 0 && position !== 0;
  const pull = departing ? 42 : 0;
  const lift = departing ? 4 : position === 0 ? -3 : 1;
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    const mix = (from, to) => from + (to - from) * t;
    return {
      ...orbFrame({
        x: mix(start.x, end.x) - Math.sin(Math.PI * t) * pull,
        y: mix(start.y, 0) + Math.sin(Math.PI * t) * lift,
        z: mix(start.z, end.z),
        size: mix(start.size, end.size),
        opacity: mix(start.opacity, end.opacity),
        zIndex: end.zIndex,
      }),
      offset: t,
    };
  });
}

function readCharacter(element) {
  const style = getComputedStyle(element);
  return { opacity: style.opacity, filter: style.filter, transform: style.transform };
}

function CharacterLine({ text, className }) {
  return (
    <span className={className}>
      {characters(text).map((character, index) => (
        <span className="promotion-inline-character" key={`${index}-${character}`}>
          {character === " " ? "\u00a0" : character}
        </span>
      ))}
    </span>
  );
}

export function PromotionInlineCarousel({ items = [], onAction, onClose, paused = false }) {
  const [view, setView] = useState(() => {
    const index = initialSlide(items.length);
    return { index, previousIndex: index, revision: 0, instant: true };
  });
  const bannerRef = useRef(null);
  const orbRefs = useRef([]);
  const copyRefs = useRef([]);
  const clockRef = useRef(null);
  const animationsRef = useRef(new Map());
  const animationGenerationRef = useRef(0);
  const initializedRef = useRef(false);
  const reducedMotionRef = useRef(null);
  const transitionRef = useRef(null);
  const settleRef = useRef(null);
  const instantNextRef = useRef(false);
  const externalPausedRef = useRef(paused);
  const viewRef = useRef(view);
  const itemsRef = useRef(items);
  externalPausedRef.current = paused;
  viewRef.current = view;
  itemsRef.current = items;

  function cancelAnimations() {
    animationGenerationRef.current += 1;
    for (const [animation, element] of animationsRef.current) {
      animation.cancel();
      element.style.willChange = "";
    }
    animationsRef.current.clear();
  }

  function animate(element, frames, options, onFinish) {
    const generation = animationGenerationRef.current;
    element.style.willChange = element.classList.contains("promotion-inline-character")
      ? "transform, opacity, filter" : "transform, opacity";
    const animation = element.animate(frames, { fill: "none", ...options });
    animationsRef.current.set(animation, element);
    animation.onfinish = () => {
      if (generation !== animationGenerationRef.current) return;
      element.style.willChange = "";
      animationsRef.current.delete(animation);
      onFinish?.();
      if (!animationsRef.current.size && bannerRef.current) bannerRef.current.dataset.motion = "idle";
    };
  }

  function settle(current) {
    cancelAnimations();
    const count = itemsRef.current.length;
    orbRefs.current.forEach((element, index) => {
      if (element && count) Object.assign(element.style, slotFrame((index - current.index + count) % count));
    });
    copyRefs.current.forEach((layer, index) => {
      if (layer) layer.style.visibility = index === current.index ? "visible" : "hidden";
      layer?.querySelectorAll(".promotion-inline-character").forEach((character) => {
        Object.assign(character.style, {
          opacity: index === current.index ? "1" : "0",
          filter: "blur(0px)", transform: "translate3d(0, 0, 0)",
        });
      });
    });
    if (bannerRef.current) bannerRef.current.dataset.motion = "idle";
  }
  settleRef.current = () => settle(viewRef.current);

  transitionRef.current = (nextIndex) => {
    const current = viewRef.current;
    const instant = instantNextRef.current || Boolean(reducedMotionRef.current?.matches);
    instantNextRef.current = false;
    if (!itemsRef.current[nextIndex]) return;
    if (nextIndex === current.index) {
      if (instant) settle(current);
      return;
    }
    const next = { index: nextIndex, previousIndex: current.index, revision: current.revision + 1, instant };
    viewRef.current = next;
    setView(next);
  };

  useLayoutEffect(() => {
    const current = viewRef.current;
    const firstOrb = orbRefs.current.find(Boolean);
    if (!initializedRef.current || current.instant || reducedMotionRef.current?.matches || !firstOrb?.animate) {
      initializedRef.current = true;
      settle(current);
      return;
    }
    // Read every layer before cancelling. Stable per-item layers also make A→B→A
    // resume the partially visible A rather than replacing text or snapping it opaque.
    const interrupted = animationsRef.current.size > 0;
    const circleStarts = orbRefs.current.map((element) => element && readOrb(element));
    const copyStarts = copyRefs.current.map((layer) =>
      [...(layer?.querySelectorAll(".promotion-inline-character") || [])].map(readCharacter));
    cancelAnimations();
    if (bannerRef.current) bannerRef.current.dataset.motion = "running";
    const count = itemsRef.current.length;
    orbRefs.current.forEach((element, index) => {
      if (!element) return;
      const position = (index - current.index + count) % count;
      Object.assign(element.style, slotFrame(position));
      animate(element, orbTrajectory(circleStarts[index], (index - current.previousIndex + count) % count, position), {
        duration: ORBIT_DURATION, easing: EASE_MOVE,
      });
    });
    copyRefs.current.forEach((layer, layerIndex) => {
      const incoming = layerIndex === current.index;
      const visible = incoming || copyStarts[layerIndex].some((start) => Number(start.opacity) > 0.001);
      if (layer) layer.style.visibility = visible ? "visible" : "hidden";
      let characterIndex = 0;
      let remaining = 0;
      // Stagger each line independently, keeping the description in step with the title.
      layer?.querySelectorAll(".promotion-inline-title, .promotion-inline-description").forEach((line) => {
        const letters = [...line.querySelectorAll(".promotion-inline-character")];
        const stagger = Math.min(10, 60 / Math.max(1, letters.length - 1));
        letters.forEach((letter, index) => {
          const sampled = copyStarts[layerIndex][characterIndex++];
          const opacity = Number(sampled.opacity);
          const resting = { opacity: incoming ? 1 : 0, filter: "blur(0px)", transform: "translate3d(0, 0, 0)" };
          Object.assign(letter.style, resting);
          if (!incoming && opacity < 0.001) return;
          const start = incoming && opacity < 0.001
            ? { opacity: 0, filter: "blur(3px)", transform: "translate3d(0, 3px, 0)" }
            : sampled;
          const end = incoming ? resting
            : { opacity: 0, filter: "blur(3px)", transform: "translate3d(0, -3px, 0)" };
          // Both directions start together with matching timing; there is no blank beat.
          remaining += 1;
          animate(letter, [start, end], {
            duration: 220,
            delay: interrupted ? 0 : index * stagger,
            fill: "backwards", easing: EASE_TEXT,
          }, () => {
            remaining -= 1;
            if (!incoming && remaining === 0) layer.style.visibility = "hidden";
          });
        });
      });
    });
  }, [view.revision]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query;
    const onReducedMotionChange = () => { if (query.matches) settleRef.current?.(); };
    query.addEventListener("change", onReducedMotionChange);
    return () => {
      query.removeEventListener("change", onReducedMotionChange);
      cancelAnimations();
      initializedRef.current = false;
      reducedMotionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!items.length) return undefined;
    const clock = createPromotionClock({
      count: items.length,
      onIndexChange: (index) => transitionRef.current?.(index),
    });
    clockRef.current = clock;
    instantNextRef.current = true;
    clock.select(initialSlide(items.length));
    clock.setPaused("external", externalPausedRef.current);
    clock.setPaused("document", document.hidden);
    clock.setPaused("hover", window.matchMedia("(hover: hover)").matches && (bannerRef.current?.matches(":hover") ?? false));
    clock.setPaused("focus", Boolean(bannerRef.current?.contains(document.activeElement) && document.activeElement?.matches(":focus-visible")));
    const onVisibilityChange = () => {
      clock.setPaused("document", document.hidden);
      for (const animation of animationsRef.current.keys()) {
        if (document.hidden) animation.pause();
        else if (animation.playState === "paused") animation.play();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    clock.start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clock.dispose();
      if (clockRef.current === clock) clockRef.current = null;
    };
  }, [items.length]);

  useEffect(() => { clockRef.current?.setPaused("external", paused); }, [paused]);

  const visibleIndex = view.index < items.length ? view.index : 0;
  const item = items[visibleIndex];
  if (!item) return null;

  function stepSlide(direction, event) {
    const count = itemsRef.current.length;
    if (count < 2) return;
    instantNextRef.current = event.detail === 0;
    const currentIndex = viewRef.current.index < count ? viewRef.current.index : 0;
    clockRef.current?.select((currentIndex + direction + count) % count);
  }

  return (
    <article
      ref={bannerRef}
      className="promotion-inline-carousel"
      data-active-index={visibleIndex}
      data-transition-id={view.revision}
      aria-label="推荐活动"
      aria-roledescription="轮播"
      onPointerEnter={(event) => { if (event.pointerType !== "touch") clockRef.current?.setPaused("hover", true); }}
      onPointerLeave={() => clockRef.current?.setPaused("hover", false)}
      onFocusCapture={(event) => clockRef.current?.setPaused("focus", event.target.matches(":focus-visible"))}
      onKeyDownCapture={() => clockRef.current?.setPaused("focus", true)}
      onPointerDownCapture={() => clockRef.current?.setPaused("focus", false)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clockRef.current?.setPaused("focus", false);
      }}
    >
      <div className="promotion-inline-media">
        <div className="promotion-inline-stack" role="group" aria-label="选择活动">
          {items.map((slide, index) => {
            const position = (index - visibleIndex + items.length) % items.length;
            return (
              <button
                type="button"
                key={slide.kind || `${index}-${slide.image}`}
                ref={(element) => { orbRefs.current[index] = element; }}
                className="promotion-inline-orb"
                data-slot={position}
                aria-label={`显示活动 ${index + 1}：${slide.title}`}
                aria-pressed={index === visibleIndex}
                aria-hidden={position !== 0 || undefined}
                tabIndex={position === 0 ? 0 : -1}
                style={{ pointerEvents: position === 0 ? "auto" : "none" }}
                onClick={(event) => {
                  instantNextRef.current = event.detail === 0;
                  clockRef.current?.select(index);
                }}
              >
                <span className="promotion-inline-orb-visual" aria-hidden="true">
                  <img src={slide.image} alt="" draggable="false" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="promotion-inline-content">
        <button
          type="button"
          className="promotion-inline-copy"
          aria-label={`${item.title}：${item.description}。${item.action || "查看活动"}`}
          onClick={() => onAction?.(item)}
          aria-live="off"
        >
          {items.map((slide, layer) => (
            <span
              key={slide.kind || `${layer}-${slide.image}`}
              ref={(element) => { copyRefs.current[layer] = element; }}
              className="promotion-inline-copy-layer"
              data-copy-layer={layer}
              data-current={layer === visibleIndex}
              aria-hidden="true"
            >
              <CharacterLine className="promotion-inline-title" text={slide.title} />
              <CharacterLine className="promotion-inline-description" text={slide.description} />
            </span>
          ))}
        </button>
        <div className="promotion-inline-actions">
          <div className="promotion-inline-controls">
            {items.length > 1 && <>
              <button type="button" className="promotion-inline-step" aria-label="上一条活动" onClick={event => stepSlide(-1, event)}>
                <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button type="button" className="promotion-inline-step" aria-label="下一条活动" onClick={event => stepSlide(1, event)}>
                <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </>}
            <button type="button" className="promotion-inline-close" aria-label="关闭活动推荐" onClick={onClose}>
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="promotion-inline-action" onClick={() => onAction?.(item)}>
            {item.inlineAction || item.action || "查看活动"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default PromotionInlineCarousel;
