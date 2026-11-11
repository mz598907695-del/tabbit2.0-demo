import './segmented-control.css';

export default function SegmentedControl({ label, value, options, onChange, controlsId, className = '' }) {
  return <div className={`aiw-segmented-control ${className}`} role="tablist" aria-label={label}>
    {options.map(({ value: option, label: text, Icon, iconClass }) => <button key={option} type="button" role="tab" aria-label={text} aria-selected={value === option} aria-controls={controlsId} tabIndex={value === option ? 0 : -1} onClick={() => onChange(option)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = options.findIndex(item => item.value === option);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
      onChange(options[next].value);
      event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
    }}>{Icon && <Icon size={14} aria-hidden="true"/>}{iconClass && <span className={`iconfont ${iconClass}`} aria-hidden="true"/>}<span>{text}</span></button>)}
  </div>;
}
