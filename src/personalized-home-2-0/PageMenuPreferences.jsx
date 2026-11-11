import { ArrowLeftRight, Check, ChevronRight, LayoutGrid, Scaling, Type } from "./icons";

const choices = {
  shortcutSize: { label: '图标大小', Icon: Scaling, options: [['large', '大'], ['medium', '中'], ['small', '小']] },
  pageWidth: { label: '看板宽度', Icon: ArrowLeftRight, options: [['standard', '标宽'], ['wide', '超宽']] },
};

export const isPagePreferenceView = view => Object.hasOwn(choices, view);
export const pagePreferenceLabel = view => choices[view]?.label;

// Keep rows directly inside either menu so styling and keyboard navigation are shared.
export default function PageMenuPreferences({ preferences, view, activeView, onView, onChange }) {
  if (!preferences) return null;
  const choice = choices[view];
  if (choice) return <>
    {choice.options.map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={preferences[view] === value} onClick={() => onChange(view, value)}>
      <span className="home-menu-check-slot" aria-hidden="true">{preferences[view] === value && <Check size={16} />}</span><span>{label}</span>
    </button>)}
  </>;

  return <>
    {[{ key: 'shortcuts', label: '显示快捷方式', Icon: LayoutGrid }, { key: 'shortcutLabels', label: '显示名称', Icon: Type }].map(({ key, label, Icon }) => <button key={key} type="button" role="menuitemcheckbox" aria-checked={Boolean(preferences[key])} disabled={key === 'shortcutLabels' && !preferences.shortcuts} onClick={() => onChange(key, !preferences[key])}>
      <Icon size={16} aria-hidden="true" /><span>{label}</span><span className="home-menu-trailing" aria-hidden="true">{preferences[key] && <Check size={14} />}</span>
    </button>)}
    {Object.entries(choices).map(([key, { label, Icon, options }]) => <button key={key} type="button" role="menuitem" data-setting-key={key} aria-haspopup="menu" aria-expanded={activeView === key} disabled={key === 'shortcutSize' && !preferences.shortcuts} onClick={() => onView(key, true)} onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); onView(key, true); }
    }}>
      <Icon size={16} aria-hidden="true" /><span>{label}</span><span className="home-menu-trailing" aria-hidden="true"><span>{options.find(([value]) => value === preferences[key])?.[1]}</span><ChevronRight size={14} /></span>
    </button>)}
  </>;
}
