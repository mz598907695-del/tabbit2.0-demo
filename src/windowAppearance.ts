export type WindowAppearance = "system" | "light" | "dark";
export type ResolvedWindowAppearance = "light" | "dark";

export const WINDOW_APPEARANCE_KEY = "tabbit-window-appearance-v1";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
let appearanceFrame = 0;

export function readWindowAppearance(storage: Pick<Storage, "getItem"> = localStorage): WindowAppearance {
  const saved = storage.getItem(WINDOW_APPEARANCE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

export function resolveWindowAppearance(appearance: WindowAppearance, systemDark = window.matchMedia(SYSTEM_DARK_QUERY).matches): ResolvedWindowAppearance {
  return appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
}

export function applyExistingTokenMode(appearance: WindowAppearance, systemDark?: boolean): ResolvedWindowAppearance {
  const resolved = resolveWindowAppearance(appearance, systemDark);
  const root = document.documentElement;
  if (root.dataset.mode !== resolved) {
    // A palette change should not launch hundreds of independent background,
    // border and shadow transitions across every mounted widget and panel.
    root.dataset.appearanceChanging = 'true';
    root.dataset.mode = resolved;
    if (typeof requestAnimationFrame === 'function') {
      cancelAnimationFrame(appearanceFrame);
      appearanceFrame = requestAnimationFrame(() => {
        appearanceFrame = requestAnimationFrame(() => {
          delete root.dataset.appearanceChanging;
          appearanceFrame = 0;
        });
      });
    } else delete root.dataset.appearanceChanging;
  }
  return resolved;
}

export function watchExistingTokenMode(
  appearance: WindowAppearance,
  onResolved?: (resolved: ResolvedWindowAppearance) => void,
): () => void {
  const systemTheme = window.matchMedia(SYSTEM_DARK_QUERY);
  const apply = () => {
    const resolved = applyExistingTokenMode(appearance, systemTheme.matches);
    onResolved?.(resolved);
  };
  apply();
  if (appearance !== "system") return () => {};
  systemTheme.addEventListener("change", apply);
  return () => systemTheme.removeEventListener("change", apply);
}

