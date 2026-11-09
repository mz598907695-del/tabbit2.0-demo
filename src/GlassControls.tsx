import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./GlassControls.css";
import { baseGlassSettings, defaultSpaceGlass, themedGlassSettings, GLASS_THEME_EVENT, GLASS_SPACE_THEME_EVENT } from "./demoDefaults";
import { SPACE_GESTURE_EVENT, type SpaceGestureProgress } from "./spaceTransition";
import { presetTintForMode } from "./spaceColors";
import { resolveThemeSource } from './themeSelection';

const defaults = baseGlassSettings;
type Settings = typeof defaults;
const actualTint = (value:number) => 5 + Math.max(0,Math.min(100,value)) * .5;
const visualSettings = (settings: Settings) => ({
  tint: [...[1, 3, 5].map((offset) => parseInt(settings.color.slice(offset, offset + 2), 16)), 255 * actualTint(settings.tint) / 100],
  opacity:100,
  clear: settings.clear, veil: settings.veil, highlight: settings.highlight, edge: settings.edge,
});

let renderedGlass = visualSettings(defaults);
let renderedSpace: string | undefined;
type GlassUpdate = { tint: number[]; opacity:number; clear: boolean; onComplete: (error?: unknown) => void };
let pendingGlassUpdate: GlassUpdate | undefined;
let updatingGlass = false;

async function updateNativeGlass(update: GlassUpdate) {
  pendingGlassUpdate = update;
  if (updatingGlass) return;
  updatingGlass = true;
  try {
    while (pendingGlassUpdate) {
      const next = pendingGlassUpdate;
      pendingGlassUpdate = undefined;
      try {
        await invoke("update_glass", { tint: next.tint, clear: next.clear, opacity:next.opacity / 100 });
        next.onComplete();
      } catch (error) {
        next.onComplete(error);
      }
    }
  } finally {
    updatingGlass = false;
  }
}

export default function GlassControls({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const storageKey = `tabbit-glass-space:${spaceId}`;
  const spaceDefaults = defaultSpaceGlass(spaceId);
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const theme = localStorage.getItem(`tabbit-glass-theme:${spaceId}`) || 'light';
      if (resolveThemeSource(theme, localStorage.getItem(`tabbit-glass-theme-source:${spaceId}`)) === 'gallery') return { ...defaults };
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const color = parsed.color || spaceDefaults.color;
        const storedTint = Number(localStorage.getItem(`tabbit-glass-tint:${spaceId}`) ?? parsed.tint ?? spaceDefaults.tint);
        const dark = document.documentElement.dataset.mode === "dark";
        const presetTint = presetTintForMode(color, dark);
        const migrateOldPresetDefault = presetTint !== undefined && presetTint !== 50 && storedTint === 50;
        if (migrateOldPresetDefault) localStorage.setItem(`tabbit-glass-user-tint:${spaceId}`, "false");
        const tint = migrateOldPresetDefault || localStorage.getItem(`tabbit-glass-user-tint:${spaceId}`) !== "true" ? presetTint ?? storedTint : storedTint;
        return { ...themedGlassSettings(color, tint), clear:parsed.clear === true };
      }
      // Preserve the previous global adjustment under the space currently open.
      const legacy = localStorage.getItem("tabbit-glass-settings");
      const owner = localStorage.getItem("tabbit-glass-legacy-space");
      if (legacy && (!owner || owner === spaceId)) {
        localStorage.setItem("tabbit-glass-legacy-space", spaceId);
        const color = JSON.parse(legacy).color || spaceDefaults.color;
        return themedGlassSettings(color, presetTintForMode(color, document.documentElement.dataset.mode === "dark"));
      }
      return { ...spaceDefaults, tint:presetTintForMode(spaceDefaults.color, document.documentElement.dataset.mode === "dark") ?? spaceDefaults.tint };
    }
    catch { return defaults; }
  });
  const userAdjusted = useRef({
    tint:localStorage.getItem(`tabbit-glass-user-tint:${spaceId}`) === 'true'
      || (localStorage.getItem(`tabbit-glass-user-tint:${spaceId}`) === null && settings.tint !== (presetTintForMode(settings.color, document.documentElement.dataset.mode === "dark") ?? themedGlassSettings(settings.color).tint)),
    clear:localStorage.getItem(`tabbit-glass-user-clear:${spaceId}`) === 'true'
      || (localStorage.getItem(`tabbit-glass-user-clear:${spaceId}`) === null && settings.clear),
  });
  const [error, setError] = useState("");
  const native = "__TAURI_INTERNALS__" in window;
  useEffect(() => {
    const root = document.documentElement;
    const syncPresetTint = () => {
      if (userAdjusted.current.tint) return;
      setSettings(current => {
        const tint = presetTintForMode(current.color, root.dataset.mode === "dark");
        return tint === undefined || tint === current.tint ? current : { ...current, tint };
      });
    };
    const observer = new MutationObserver(syncPresetTint);
    observer.observe(root, { attributes:true, attributeFilter:["data-mode"] });
    syncPresetTint();
    return () => observer.disconnect();
  }, [spaceId]);
  useEffect(() => {
    const select = (event:Event) => {
      const detail = (event as CustomEvent<{ color?:string; theme?:string; themeSource?:string; appearance?:string; tint?:number; clear?:boolean; preset?:boolean; reset?:boolean }>).detail;
      if (!detail) return;
      const currentTheme = localStorage.getItem(`tabbit-glass-theme:${spaceId}`) || 'light';
      const gallery = resolveThemeSource(currentTheme, localStorage.getItem(`tabbit-glass-theme-source:${spaceId}`)) === 'gallery';
      if (gallery && !detail.themeSource && (detail.tint !== undefined || detail.clear !== undefined || detail.color !== undefined)) return;
      if (detail.preset && typeof detail.tint === "number") {
        userAdjusted.current.tint = false;
        localStorage.setItem(`tabbit-glass-user-tint:${spaceId}`, "false");
      }
      if (detail.reset && typeof detail.clear === "boolean") {
        userAdjusted.current.clear = false;
        localStorage.setItem(`tabbit-glass-user-clear:${spaceId}`, "false");
      }
      for (const key of ['tint','clear'] as const) {
        if (!detail.preset && detail[key] !== undefined) userAdjusted.current[key] = true;
        localStorage.setItem(`tabbit-glass-user-${key}:${spaceId}`, String(userAdjusted.current[key]));
      }
      if (typeof detail.color === 'string' || typeof detail.tint === 'number' || typeof detail.clear === 'boolean') setSettings(current => ({
        ...themedGlassSettings(detail.color ?? current.color, detail.tint ?? current.tint),
        clear:detail.preset && !detail.reset && userAdjusted.current.clear ? current.clear : detail.clear ?? current.clear,
      }));
      if (typeof detail.theme === 'string') localStorage.setItem(`tabbit-glass-theme:${spaceId}`, detail.theme);
      if (detail.themeSource) localStorage.setItem(`tabbit-glass-theme-source:${spaceId}`, detail.themeSource);
      if (detail.appearance) localStorage.setItem(`tabbit-glass-theme-appearance:${spaceId}`, detail.appearance);
    };
    window.addEventListener(GLASS_THEME_EVENT, select);
    return () => window.removeEventListener(GLASS_THEME_EVENT, select);
  }, [spaceId]);
  useEffect(() => {
    const theme = localStorage.getItem(`tabbit-glass-theme:${spaceId}`) || 'light';
    window.dispatchEvent(new CustomEvent(GLASS_SPACE_THEME_EVENT, { detail:{ spaceId, theme,
      themeSource:resolveThemeSource(theme, localStorage.getItem(`tabbit-glass-theme-source:${spaceId}`)),
      appearance:localStorage.getItem(`tabbit-glass-theme-appearance:${spaceId}`),
      color:settings.color, tint:settings.tint, clear:settings.clear, spaceName } }));
  }, [settings.color, settings.tint, settings.clear, spaceId, spaceName]);
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    localStorage.setItem(`tabbit-glass-tint:${spaceId}`, String(settings.tint));
  }, [settings, storageKey]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const from = renderedGlass;
    const target = visualSettings(settings);
    const switching = renderedSpace !== undefined && renderedSpace !== spaceId;
    renderedSpace = spaceId;
    let cancelled = false;
    let gestureSource: typeof from | null = null;
    let rollbackFrame = 0;
    let colorFrame = 0;
    const applyBetween = (start:typeof from, end:typeof target, progress:number) => {
      const mix = (start: number, end: number) => start + (end - start) * progress;
      renderedGlass = {
        tint: end.tint.map((value, index) => mix(start.tint[index], value)),
        opacity:mix(start.opacity,end.opacity),
        clear: progress < .5 ? start.clear : end.clear,
        veil: mix(start.veil, end.veil),
        highlight: mix(start.highlight, end.highlight),
        edge: mix(start.edge, end.edge),
      };
      root.style.setProperty("--glass-veil", String(renderedGlass.veil / 100));
      root.style.setProperty("--glass-highlight", String(renderedGlass.highlight / 100));
      root.style.setProperty("--glass-edge", String(renderedGlass.edge / 100));
      root.style.setProperty("--glass-opacity", String(renderedGlass.opacity / 100));
      if (native) {
        void updateNativeGlass({
          tint: renderedGlass.tint.map(Math.round), clear: renderedGlass.clear, opacity:renderedGlass.opacity,
          onComplete: (cause) => {
            if (cancelled) return;
            setError(cause ? String(cause) : "");
          },
        });
      }
    };
    const apply = (progress:number) => applyBetween(from, target, progress);
    const syncGesture = (event:Event) => {
      const detail = (event as CustomEvent<SpaceGestureProgress | null>).detail;
      if (detail) {
        if (detail.fromSpaceId !== spaceId) return;
        cancelAnimationFrame(rollbackFrame);
        cancelAnimationFrame(colorFrame);
        gestureSource ??= renderedGlass;
        let destination = defaultSpaceGlass(detail.toSpaceId);
        try {
          const saved = JSON.parse(localStorage.getItem(`tabbit-glass-space:${detail.toSpaceId}`) || '{}');
          destination = { ...themedGlassSettings(saved.color || destination.color, Number(localStorage.getItem(`tabbit-glass-tint:${detail.toSpaceId}`) ?? 50)), clear:saved.clear === true };
        } catch { /* Default material. */ }
        applyBetween(gestureSource, visualSettings(destination), Math.max(0,Math.min(1,detail.progress)));
        return;
      }
      if (!gestureSource) return;
      gestureSource = null;
      const rollbackFrom = renderedGlass;
      const began = performance.now();
      const tick = (now:number) => {
        if (cancelled) return;
        const progress = Math.min(1,(now-began)/240);
        applyBetween(rollbackFrom,target,1-(1-progress)**3);
        if (progress < 1) rollbackFrame = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(rollbackFrame);
      rollbackFrame = requestAnimationFrame(tick);
    };
    window.addEventListener(SPACE_GESTURE_EVENT, syncGesture);
    // Material motion is independent of the content, which switches immediately.
    if (switching && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const began = performance.now();
      const tick = (now:number) => {
        if (cancelled) return;
        const progress = Math.min(1,(now-began)/240);
        apply(1-(1-progress)**3);
        if (progress < 1) colorFrame = requestAnimationFrame(tick);
      };
      colorFrame = requestAnimationFrame(tick);
    } else apply(1);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rollbackFrame);
      cancelAnimationFrame(colorFrame);
      window.removeEventListener(SPACE_GESTURE_EVENT, syncGesture);
    };
  }, [settings, native, spaceId]);

  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (key === "tint") { userAdjusted.current.tint = true; localStorage.setItem(`tabbit-glass-user-tint:${spaceId}`, "true"); }
    if (key === "clear") { userAdjusted.current.clear = true; localStorage.setItem(`tabbit-glass-user-clear:${spaceId}`, "true"); }
    setSettings(current => ({ ...current, [key]:value }));
  };
  const slider = (key: "tint" | "veil" | "highlight" | "edge", label: string) => <label className="glass-control-row">
    <span>{label}<output>{settings[key]}%</output></span>
    <input aria-label={label} type="range" min="0" max="100" value={settings[key]} onChange={event => change(key, Number(event.target.value))}/>
  </label>;
  const reset = () => {
    userAdjusted.current = { tint:false, clear:false };
    localStorage.setItem(`tabbit-glass-user-tint:${spaceId}`, "false");
    localStorage.setItem(`tabbit-glass-user-clear:${spaceId}`, "false");
    const tint = presetTintForMode(spaceDefaults.color, document.documentElement.dataset.mode === "dark") ?? spaceDefaults.tint;
    setSettings({ ...spaceDefaults, tint });
  };

  return <aside hidden className={`glass-debug${open ? " expanded" : ""}`} onClick={event => event.stopPropagation()}>
    <button className="glass-debug-toggle" type="button" onClick={() => setOpen(value => !value)}>玻璃调试 <span>{open ? "收起" : "展开"}</span></button>
    {open && <div className="glass-debug-body">
      <div className="glass-debug-space">当前空间：{spaceName}<span>自动保存</span></div>
      <div className="glass-debug-status">{native ? "原生玻璃 · 实时预览" : "网页预览 · 原生材质请在桌面窗口查看"}</div>
      <label className="glass-control-row"><span>玻璃材质</span><select aria-label="玻璃材质" value={settings.clear ? "clear" : "regular"} onChange={event => change("clear", event.target.value === "clear")}><option value="regular">Regular · 标准</option><option value="clear">Clear · 通透</option></select></label>
      <label className="glass-control-row glass-color-row"><span>染色颜色</span><input aria-label="染色颜色" type="color" value={settings.color} onChange={event => change("color", event.target.value)}/><code>{settings.color}</code></label>
      {slider("tint", "染色浓度")}
      {slider("veil", "白色罩层")}
      {slider("highlight", "顶部高光")}
      {slider("edge", "边缘高光")}
      {error && <p className="glass-debug-error">玻璃更新失败：{error}</p>}
      <label className="glass-control-row"><span>当前空间参数 · 可选中复制</span><textarea aria-label="当前玻璃参数" readOnly value={JSON.stringify({ space:spaceName, ...settings }, null, 2)}/></label>
      <button className="glass-debug-reset" type="button" onClick={reset}>重置当前空间材质</button>
    </div>}
  </aside>;
}
