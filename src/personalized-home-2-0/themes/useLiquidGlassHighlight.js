import { useEffect } from 'react';
import { attachLiquidGlassHighlight } from './liquidGlassHighlight.js';

export function useLiquidGlassHighlight(enabled) {
  useEffect(() => enabled ? attachLiquidGlassHighlight() : undefined, [enabled]);
}
