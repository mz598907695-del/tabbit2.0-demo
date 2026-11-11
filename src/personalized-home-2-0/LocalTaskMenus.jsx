import { Check, Shield, ShieldCheck, ShieldQuestion } from "./icons";
import './local-task-menus.css';

export const APPROVAL_POLICIES = [
  { id: 'ask', name: '始终询问', Icon: ShieldQuestion, description: '修改工作区外文件时始终由你审批' },
  { id: 'auto', name: '自动审批', Icon: ShieldCheck, description: '优先由 AI 审核，只需你确认风险操作' },
  { id: 'full', name: '完全访问', Icon: Shield, description: '可不受限制地访问你电脑上的任何文件' },
];

export default function LocalTaskMenus({ anchor, id, Popover, onClose, approvalPolicy, onApprovalPolicyChange }) {
  return <Popover anchor={anchor} kind="approval" id={id} label="审批策略" width={336} maxHeight={300} onClose={onClose}>
    <div className="tb-composer-menu-heading">审批策略</div>
    {APPROVAL_POLICIES.map(policy => <button key={policy.id} type="button" className={`tb-composer-menu-row tb-mount-runtime-choice tb-local-task-choice${policy.id === 'full' ? ' is-full-access' : ''}`} role="menuitemradio" aria-checked={approvalPolicy === policy.id} data-composer-menu-item="" onClick={() => { onApprovalPolicyChange(policy.id); onClose(); }}>
      <policy.Icon size={16} aria-hidden="true" />
      <span className="tb-mount-runtime-copy"><strong>{policy.name}</strong><small>{policy.description}</small></span>
      {approvalPolicy === policy.id && <Check className="tb-mount-choice-check" size={16} strokeWidth={2.5} aria-hidden="true" />}
    </button>)}
  </Popover>;
}
