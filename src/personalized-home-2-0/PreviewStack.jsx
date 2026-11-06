import './preview-stack.css';

/** Shared overlapping previews; layout and artwork remain with each consumer. */
export default function PreviewStack({ as: Element = 'div', className = '', children, ...props }) {
  return <Element className={`preview-stack ${className}`.trim()} {...props}>{children}</Element>;
}

export function PreviewStackItem({ as: Element = 'div', className = '', tilt = 0, style, children, ...props }) {
  return (
    <Element className={`preview-stack-item ${className}`.trim()} style={{ '--preview-tilt': `${tilt}deg`, ...style }} {...props}>
      {children}
    </Element>
  );
}
