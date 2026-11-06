import { useEffect, useRef, type ReactNode } from "react";
import "./styles/dropdown.css";

export default function DropdownPanel({ children, className = "", label, onClose }: { children: ReactNode; className?: string; label: string; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose?.(); }
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length].focus();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);
  return <div ref={ref} className={`dropdown-panel ${className}`} aria-label={label} onClick={(event) => event.stopPropagation()}>{children}</div>;
}
