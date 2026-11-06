import { useId } from 'react';
import { ChevronDown, ChevronRight } from "../icons";
import SettingSegments from '../SettingSegments';
import './board-settings.css';

export default function BoardSettings({ SettingSwitch, showModule, onShowModule, moduleDescription = '点击 Logo 快速切换开关。', shortcutShape = 'circle', onShortcutShape, shortcutSize = 'medium', onShortcutSize, showNames, onShowNames, pageWidth = 'standard', onPageWidth, pageCount = 0, onEditPages, editPagesRef, onAdd }) {
  const id = useId();

  return <section className="overlay-settings-group board-settings" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>快捷方式与小组件</h3>
    <div className="overlay-settings-card">
      <SettingSwitch label="显示快捷方式" description={moduleDescription} checked={showModule} onChange={onShowModule} />
      <SettingSwitch label="显示名称" description="快捷方式与小组件统一显示。" checked={showNames} onChange={onShowNames} disabled={!showModule} />
      <SettingSegments
        label="卡片圆角"
        value={shortcutShape}
        options={[{ value: 'circle', label: '大' }, { value: 'square', label: '小' }]}
        onChange={onShortcutShape}
        disabled={!showModule}
      />
      <SettingSegments
        label="图标大小"
        value={shortcutSize}
        options={[{ value: 'large', label: '大' }, { value: 'medium', label: '中' }, { value: 'small', label: '小' }]}
        onChange={onShortcutSize}
        disabled={!showModule}
      />
    </div>
    <h3 id={`${id}-management-heading`} className="board-management-heading">页面设置</h3>
    <div className="overlay-settings-card board-management-card" role="group" aria-labelledby={`${id}-management-heading`}>
      <button type="button" className="overlay-setting-row board-setting-action" disabled={!showModule} onClick={onAdd}>
        <span className="board-action-label">添加内容</span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      <button ref={editPagesRef} type="button" className="overlay-setting-row board-setting-action" aria-label={`编辑页面，共 ${pageCount} 个页面`} onClick={onEditPages}>
        <span className="board-action-label">编辑页面</span>
        <span className="board-action-trailing" aria-hidden="true">
          <span className="board-page-count">{pageCount}</span>
          <ChevronRight size={14} />
        </span>
      </button>
      <label className="overlay-setting-row board-width-setting">
        <span className="overlay-setting-copy">
          <span className="overlay-setting-label">页面宽度</span>
          <span id={`${id}-width-description`} className="overlay-setting-description">
            {pageWidth === 'wide' ? '每行最多 15 个快捷方式，窄屏自动收缩。' : '快捷方式与小组件和输入框同宽。'}
          </span>
        </span>
        <span className="overlay-select-wrap">
          <select aria-label="页面宽度" aria-describedby={`${id}-width-description`} value={pageWidth} onChange={event => onPageWidth?.(event.target.value)}>
            <option value="standard">标宽</option>
            <option value="wide">超宽</option>
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </span>
      </label>
    </div>
  </section>;
}
