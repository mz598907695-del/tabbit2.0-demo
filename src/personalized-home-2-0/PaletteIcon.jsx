import { Palette } from './icons';
export function PaletteIcon({ size = 28, className = '', ...props }) {
  return <span {...props} className={`host-palette-icon ${className}`}><Palette size={size}/></span>;
}
