import { getHomeRoot } from "./home-host";
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Asterisk, Cat, Check, Fish, Sparkles } from "./icons";
import { MODEL_GROUPS } from './composer-data';
import { MAX_REPLY_MODELS, MIN_REPLY_MODELS } from './composer-models';

function ModelIcon({ name }) {
  if (name === 'openai') return <img className="tb-model-icon tb-model-openai" src="/personalized-home-2-0/asset/icons/svg_a13912b3.svg" alt="" />;
  if (name === 'opus') return <Asterisk className="tb-model-icon tb-model-opus" size={16} strokeWidth={1.7} aria-hidden="true" />;
  if (name === 'deep') return <Fish className="tb-model-icon tb-model-deep" size={16} aria-hidden="true" />;
  if (name === 'longcat') return <Cat className="tb-model-icon tb-model-longcat" size={16} aria-hidden="true" />;
  if (name === 'kimi' || name === 'glm') return <span className={`tb-model-icon tb-model-${name}`} aria-hidden="true">{name === 'kimi' ? 'K' : 'Z'}</span>;
  return <Sparkles className="tb-model-icon" size={16} aria-hidden="true" />;
}

function ModelLimitHint({ anchor, id }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const bounds = anchor.getBoundingClientRect();
      const hint = ref.current.getBoundingClientRect();
      setPosition({
        left: Math.max(8, Math.min(window.innerWidth - hint.width - 8, bounds.left + (bounds.width - hint.width) / 2)),
        top: bounds.top >= hint.height + 16 ? bounds.top - hint.height - 7 : bounds.bottom + 7,
      });
    };
    place();
    const owner = anchor.closest('[data-composer-owner]')?.dataset.composerOwner;
    const composer = owner && document.querySelector(`.tb-composer-wrap[data-composer-owner="${CSS.escape(owner)}"]`);
    composer?.addEventListener('composergeometrychange', place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      composer?.removeEventListener('composergeometrychange', place);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);
  return createPortal(<div ref={ref} id={id} role="tooltip" className="tb-model-limit-hint"
    style={position || { visibility: 'hidden' }}>最多选择 5 个模型回答</div>, anchor.closest('dialog') || getHomeRoot());
}

export default function ComposerModelMenu({ selection, onSelect, onModeChange }) {
  const hintId = useId();
  const [hint, setHint] = useState(null);
  const { multiple, models } = selection;
  const full = multiple && models.length >= MAX_REPLY_MODELS;
  const hintVisible = full && hint && hint.node.isConnected
    && !models.includes(hint.node.dataset.modelName);
  function clearHint(source) {
    setHint(current => current?.source === source ? null : current);
  }
  return <>
    <div className="tb-model-options" onScroll={() => clearHint('pointer')}>
      {MODEL_GROUPS.map(group => <div key={group.label || 'auto'} role="group" aria-label={group.label || '自动选择'}>
        {group.label && <div className="tb-composer-menu-heading">{group.label}</div>}
        {group.models.map(entry => {
          const order = models.indexOf(entry.name);
          const selected = order >= 0;
          const locked = full && !selected;
          return <button key={entry.name} type="button" className="tb-composer-menu-row tb-model-option"
            role={multiple ? 'menuitemcheckbox' : 'menuitemradio'} aria-checked={selected}
            aria-disabled={locked || undefined} aria-describedby={hintVisible && hint.node.dataset.modelName === entry.name ? hintId : undefined}
            data-composer-menu-item data-model-name={entry.name}
            onPointerEnter={event => { if (locked) setHint({ node: event.currentTarget, source: 'pointer' }); }}
            onPointerLeave={() => clearHint('pointer')}
            onFocus={event => { if (locked) setHint({ node: event.currentTarget, source: 'focus' }); }}
            onBlur={() => clearHint('focus')}
            onClick={event => {
              if (locked) { setHint({ node: event.currentTarget, source: 'focus' }); return; }
              setHint(null);
              onSelect(entry.name);
            }}>
            {multiple && <span className="tb-model-selector" data-selected={selected} aria-hidden="true">{selected ? order + 1 : ''}</span>}
            <ModelIcon name={entry.icon} />
            <span className="tb-model-name">{entry.name}</span>
            {!multiple && selected && <Check className="tb-model-check" size={16} aria-hidden="true" />}
          </button>;
        })}
      </div>)}
    </div>
    <div className="tb-model-footer tb-dropdown-footer">
      <button type="button" className="tb-model-mode-toggle" role="menuitemcheckbox" aria-label="多模型回复"
        aria-checked={multiple} data-composer-menu-item onClick={() => { setHint(null); onModeChange(!multiple); }}>
        <span>多模型回复</span>
        {multiple && models.length < MIN_REPLY_MODELS && <small className="tb-model-minimum" role="status">至少 2 个</small>}
        <span className="tb-model-toggle-track" aria-hidden="true"><span /></span>
      </button>
    </div>
    {hintVisible && <ModelLimitHint anchor={hint.node} id={hintId} />}
  </>;
}
