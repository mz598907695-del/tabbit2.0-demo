/** Shared surface for shortcut tiles and widgets. The inner clip keeps artwork
 * rounded without clipping the outer rim or filtering the content. */
export default function BoardCard({ as: Tag = 'div', className = '', shape = 'rounded', compact = false, children, ...props }) {
  return <Tag {...props} className={`board-card ${className}`.trim()} data-card-shape={shape} data-card-size={compact ? 'icon' : 'fill'}>
    <Tag className="board-card-content">{children}</Tag>
  </Tag>;
}
