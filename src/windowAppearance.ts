export type WindowAppearance = "system" | "light" | "dark";
export type ResolvedWindowAppearance = "light" | "dark";

export const WINDOW_APPEARANCE_KEY = "tabbit-window-appearance-v1";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function readWindowAppearance(storage: Pick<Storage, "getItem"> = localStorage): WindowAppearance {
  const saved = storage.getItem(WINDOW_APPEARANCE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

export function resolveWindowAppearance(appearance: WindowAppearance, systemDark = window.matchMedia(SYSTEM_DARK_QUERY).matches): ResolvedWindowAppearance {
  return appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
}

export function applyExistingTokenMode(appearance: WindowAppearance, systemDark?: boolean): ResolvedWindowAppearance {
  const resolved = resolveWindowAppearance(appearance, systemDark);
  document.documentElement.dataset.mode = resolved;
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

