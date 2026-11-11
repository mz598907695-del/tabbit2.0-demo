// Shared table separator: one continuous half-pixel line across all columns.
export default function WorkspaceListDivider({ columns }) {
  return <tr className="aiwf-divider-row" aria-hidden="true"><td colSpan={columns}><div className="aiwf-list-divider"/></td></tr>;
}
