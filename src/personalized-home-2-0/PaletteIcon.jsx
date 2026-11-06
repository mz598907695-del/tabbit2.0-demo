import { forwardRef, useImperativeHandle, useState } from 'react';
import { Palette } from './icons';
export const PaletteIcon = forwardRef(function PaletteIcon({ size = 28, className = '', onMouseEnter, onMouseLeave, ...props }, ref) {
  const [active, setActive] = useState(false);
  useImperativeHandle(ref, () => ({startAnimation: () => setActive(true), stopAnimation: () => setActive(false)}), []);
  return <span {...props} className={`host-palette-icon ${className}`} data-active={active}
    onMouseEnter={event => {setActive(true); onMouseEnter?.(event);}}
    onMouseLeave={event => {setActive(false); onMouseLeave?.(event);}}><Palette size={size}/></span>;
});
