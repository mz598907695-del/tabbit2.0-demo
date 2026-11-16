import { useEffect, useState } from 'react';
import { spaceColors } from './spaceColors';
import { DEFAULT_FILL_PALETTE, isFillColor, readFillPalette, THEME_FILL_PALETTE_EVENT, THEME_FILL_PALETTE_KEY, THEME_FILL_PREVIEW_EVENT, type FillMode, type FillPalette, type FillValue } from './themeFillPalette';

function HexInput({ value, label, onChange }: { value:string; label:string; onChange:(value:string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input type="text" aria-label={label} aria-invalid={!isFillColor(draft)} value={draft} spellCheck={false} maxLength={7} onChange={event => {
    const next = event.target.value;
    setDraft(next);
    if (isFillColor(next)) onChange(next.toLowerCase());
  }} onBlur={() => { if (!isFillColor(draft)) setDraft(value); }}/>;
}

export default function ThemeFillControls({ activeColor, mode }: { activeColor:string; mode:FillMode }) {
  const [palette, setPalette] = useState(readFillPalette);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setPalette(readFillPalette());
    sync();
    window.addEventListener(THEME_FILL_PALETTE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(THEME_FILL_PALETTE_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const preview = (color:string, appearance:FillMode) => window.dispatchEvent(new CustomEvent(THEME_FILL_PREVIEW_EVENT, { detail:{ color, mode:appearance } }));
  const save = (next:FillPalette) => {
    try {
      localStorage.setItem(THEME_FILL_PALETTE_KEY, JSON.stringify(next));
      setPalette(next);
      setError('');
      window.dispatchEvent(new Event(THEME_FILL_PALETTE_EVENT));
    } catch { setError('保存失败，请检查本机存储空间。'); }
  };
  const update = (name:string, color:string, appearance:FillMode, value:Partial<FillValue>) => {
    save({ ...palette, [name]:{ ...palette[name], [appearance]:{ ...palette[name][appearance], ...value } } });
    preview(color, appearance);
  };
  return <section className="fill-palette" aria-label="主题填充调色控制器">
    <div className="fill-palette-heading"><strong>主题填充调色</strong><span>当前：{mode === 'dark' ? '深色' : '浅色'}</span></div>
    <p className="fill-palette-hint">每个主题分开保存浅色、深色色值和不透明度。编辑即预览，自动保存到本机。</p>
    <div className="fill-palette-columns"><span>主题</span><span>浅色模式</span><span>深色模式</span></div>
    {spaceColors.map(preset => <div key={preset.name} className={`fill-palette-row${activeColor.toLowerCase() === preset.tintColor ? ' is-active' : ''}`}>
      <div className="fill-palette-name"><i style={{ background:preset.color }}/>{preset.name}<button type="button" aria-label={`重置${preset.name}填充色`} title="重置此主题的深浅色" onClick={() => save({ ...palette, [preset.name]:{ light:{ ...DEFAULT_FILL_PALETTE[preset.name].light }, dark:{ ...DEFAULT_FILL_PALETTE[preset.name].dark } } })}>重置</button></div>
      {(['light','dark'] as const).map(appearance => {
        const label = `${preset.name}${appearance === 'light' ? '浅色' : '深色'}`;
        const value = palette[preset.name][appearance];
        return <div key={appearance} className={`fill-palette-cell${activeColor.toLowerCase() === preset.tintColor && mode === appearance ? ' is-previewing' : ''}`}>
          <div className="fill-palette-inputs">
            <input type="color" aria-label={`${label}填充色`} value={value.color} onChange={event => update(preset.name, preset.tintColor, appearance, { color:event.target.value })}/>
            <HexInput label={`${label}HEX`} value={value.color} onChange={next => update(preset.name, preset.tintColor, appearance, { color:next })}/>
          </div>
          <label className="fill-palette-opacity">不透明度 <span><input type="number" aria-label={`${label}不透明度`} min="0" max="100" step="1" value={value.opacity} onChange={event => update(preset.name, preset.tintColor, appearance, { opacity:Math.max(0, Math.min(100, Number(event.target.value))) })}/>%</span></label>
          <input className="fill-palette-opacity-slider" type="range" aria-label={`${label}不透明度滑块`} min="0" max="100" step="1" value={value.opacity} onChange={event => update(preset.name, preset.tintColor, appearance, { opacity:Number(event.target.value) })}/>
          <button type="button" onClick={() => preview(preset.tintColor, appearance)} aria-label={`预览${label}`}>预览{appearance === 'light' ? '浅色' : '深色'}</button>
        </div>;
      })}
    </div>)}
    {error && <p role="alert" className="glass-debug-error">{error}</p>}
    <details className="fill-palette-export"><summary>查看全部色值 · 可复制</summary><textarea aria-label="全部主题填充色值" readOnly value={JSON.stringify(palette, null, 2)}/></details>
  </section>;
}
