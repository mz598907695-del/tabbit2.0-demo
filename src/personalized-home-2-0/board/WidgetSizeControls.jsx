import { useEffect, useRef, useState } from 'react';
import { MAX_WIDGET_HEIGHT } from './widget-size';

export default function WidgetSizeControls({ name, size, columns, onResize }) {
  const [draft, setDraft] = useState({ w: String(size.w), h: String(size.h) });
  const canceled = useRef(false);
  const reset = () => setDraft({ w: String(size.w), h: String(size.h) });
  useEffect(reset, [size.w, size.h]);

  function commit(event, axis) {
    const value = event.currentTarget.value;
    if (!canceled.current && value.trim() && Number.isFinite(Number(value)) && Number(value) !== size[axis]) {
      onResize({ ...size, [axis]: Number(value) }, axis);
    }
    canceled.current = false;
    reset();
  }

  return <div className="board-size-controls" role="group" aria-label={`${name}尺寸`}>
    {['w', 'h'].map(axis => <label key={axis}>
      <span>{axis === 'w' ? '宽' : '高'}</span>
      <input type="number" min="1" max={axis === 'w' ? columns : MAX_WIDGET_HEIGHT} step="1"
        aria-label={`${name}${axis === 'w' ? '宽度' : '高度'}（格）`} value={draft[axis]}
        onChange={event => setDraft({ ...draft, [axis]: event.target.value })}
        onBlur={event => commit(event, axis)}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); canceled.current = true;
            reset(); event.currentTarget.blur();
          }
        }} />
      <span className="board-size-unit">格</span>
    </label>)}
  </div>;
}
