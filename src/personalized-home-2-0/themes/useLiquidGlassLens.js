import { useEffect } from 'react';
import { attachCapsuleLens } from './liquidGlassLens.js';

export function useLiquidGlassLens(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const capsule = document.querySelector('.page-indicator-capsule');
    return capsule ? attachCapsuleLens(capsule) : undefined;
  }, [enabled]);
}
