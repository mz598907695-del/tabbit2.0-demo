export function normalizeLiquidGlassOpacity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 50;
}

// The slider controls backing fills, never foreground opacity or material size.
// Keep both committed preferences and live previews on this single recipe.
export function liquidGlassOpacityProperties(value) {
  const offset = (normalizeLiquidGlassOpacity(value) - 50) / 50;
  const lower = Math.min(offset, 0);
  const higher = Math.max(offset, 0);
  return {
    '--liquid-fill-opacity-light': .28 + lower * .1 + higher * .72,
    '--liquid-fill-opacity-dark': .38 + lower * .14 + higher * .62,
    '--liquid-clarity': -lower,
    '--liquid-library-undercoat': .64 + lower * .24 + higher * .36,
  };
}

export function applyLiquidGlassOpacity(root, value) {
  const opacity = normalizeLiquidGlassOpacity(value);
  const properties = liquidGlassOpacityProperties(opacity);
  for (const [name, amount] of Object.entries(properties)) {
    const next = amount.toFixed(3);
    if (root.style.getPropertyValue(name) !== next) root.style.setProperty(name, next);
  }
  if (opacity === 100) {
    if (root.dataset.materialOpaque !== "true") root.dataset.materialOpaque = "true";
  } else if (root.dataset.materialOpaque !== undefined) {
    delete root.dataset.materialOpaque;
  }
}
