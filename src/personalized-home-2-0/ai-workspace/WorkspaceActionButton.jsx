import './workspace-action-button.css';

export default function WorkspaceActionButton({ className = '', children, ...props }) {
  return <button type="button" {...props} className={`workspace-action-button ${className}`}>{children}</button>;
}
