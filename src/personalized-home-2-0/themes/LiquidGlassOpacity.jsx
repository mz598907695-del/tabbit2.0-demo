/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { useLayoutEffect, useRef } from 'react';
import { normalizeLiquidGlassOpacity } from './liquidGlassMaterial.js';
import { attachLiquidGlassOpacity } from './liquidGlassOpacity.js';

export default function LiquidGlassOpacity({ id, value, disabled, onCommit, describedBy }) {
  const inputRef = useRef(null);
  const controllerRef = useRef(null);
  const commitRef = useRef(onCommit);
  useLayoutEffect(() => { commitRef.current = onCommit; });
  useLayoutEffect(() => {
    const controller = attachLiquidGlassOpacity(inputRef.current, {
      value, disabled, onCommit: next => commitRef.current?.(next),
    });
    controllerRef.current = controller;
    return () => { controller.dispose(); controllerRef.current = null; };
  }, []);
  useLayoutEffect(() => { controllerRef.current?.sync(value, disabled); }, [value, disabled]);

  return <input ref={inputRef} id={id} type="range" min="0" max="100" step="1"
    defaultValue={normalizeLiquidGlassOpacity(value)} disabled={disabled} aria-describedby={describedBy} />;
}
