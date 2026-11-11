import type { ComponentType } from 'react';

declare const WorkspaceNotificationsPopover: ComponentType<{
  anchor: HTMLElement;
  align?: 'left' | 'right';
  initialEntry?: string;
  onClose: (restoreFocus: boolean) => void;
}>;

export default WorkspaceNotificationsPopover;
