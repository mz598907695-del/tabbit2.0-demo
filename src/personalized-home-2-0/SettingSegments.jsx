import { useId, useRef } from "react";

export default function SettingSegments({ label, value, options, onChange, disabled = false }) {
  const labelId = useId();
  const buttons = useRef([]);
  const selected = options.some(option => option.value === value) ? value : options[0]?.value;
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === selected));
  const segmentCount = Math.max(1, options.length);
  const segmentGap = 2;
  const segmentWidth = `calc((100% - ${4 + (segmentCount - 1) * segmentGap}px) / ${segmentCount})`;
  const segmentTransform = selectedIndex === 0 ? "translateX(0)" : `translateX(calc(${selectedIndex * 100}% + ${selectedIndex * segmentGap}px))`;

  function onKeyDown(event, index) {
    if (disabled) return;
    const next = ["ArrowRight", "ArrowDown"].includes(event.key)
      ? (index + 1) % options.length
      : ["ArrowLeft", "ArrowUp"].includes(event.key)
        ? (index - 1 + options.length) % options.length
        : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onChange?.(options[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div className={`overlay-setting-row overlay-promotion-style-row${disabled ? " is-disabled" : ""}`}>
      <span className="overlay-setting-copy">
        <span className="overlay-setting-label" id={labelId}>{label}</span>
      </span>
      <div
        className="overlay-promotion-style-control"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        style={{ "--overlay-segment-width": segmentWidth, "--overlay-segment-transform": segmentTransform }}
      >
        {options.map((option, index) => (
          <button
            type="button"
            role="radio"
            key={option.value}
            aria-checked={selected === option.value}
            tabIndex={!disabled && selected === option.value ? 0 : -1}
            disabled={disabled}
            ref={element => { buttons.current[index] = element; }}
            onClick={() => onChange?.(option.value)}
            onKeyDown={event => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
