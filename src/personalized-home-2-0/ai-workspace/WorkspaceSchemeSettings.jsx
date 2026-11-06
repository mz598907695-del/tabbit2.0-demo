import { createContext, useContext } from 'react';
import { ChevronDown, ChevronRight } from '../icons';
import { WORKSPACE_VARIANTS } from './workspace-variants';

export const WorkspaceSettingsContext = createContext(null);

export default function WorkspaceSchemeSettings() {
  const settings = useContext(WorkspaceSettingsContext);
  if (!settings) return null;
  return <section className="overlay-settings-group" aria-label="AI 侧边栏设置">
    <h3>AI 侧边栏</h3>
    <div className="overlay-settings-card">
      <label className="overlay-setting-row">
        <span className="overlay-setting-label">导航方案</span>
        <span className="overlay-select-wrap">
          <select aria-label="选择侧边栏方案" value={settings.variant} onChange={event => settings.onVariant(Number(event.target.value))}>
            {WORKSPACE_VARIANTS.map(item => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true"/>
        </span>
      </label>
      <button type="button" className="overlay-setting-row" onClick={settings.onCompare}>
        <span className="overlay-setting-label">对比导航方案</span><ChevronRight size={14} aria-hidden="true"/>
      </button>
    </div>
  </section>;
}
