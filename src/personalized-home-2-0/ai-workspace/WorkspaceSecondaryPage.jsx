import { useContext, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from '../icons';
import { WorkspaceNavigationSlot } from './workspace-secondary-context';
import './workspace-secondary-page.css';

// Secondary pages share the workspace top bar; the underlying list stays mounted.
export default function WorkspaceSecondaryPage({ title, backLabel, onBack, actions, children, active = true, className = '' }) {
  const slot = useContext(WorkspaceNavigationSlot);
  const body = useRef(null);
  useLayoutEffect(() => {
    if (active) body.current?.querySelector('h1')?.focus({ preventScroll: true });
  }, [active]);
  const navigation = <div className="aiw-secondary-navigation">
    <button className="aiw-secondary-back" onClick={onBack}><ArrowLeft size={18}/><span>{backLabel}</span></button>
    {actions && <div className="aiw-secondary-actions">{actions}</div>}
  </div>;
  return <section ref={body} className={`aiw-secondary-page ${className}`} aria-label={title} onKeyDown={event => {
    if (event.key === 'Escape' && !event.target.closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); event.stopPropagation(); onBack(); }
  }}>
    {active && (slot ? createPortal(navigation, slot) : navigation)}
    {children}
  </section>;
}
