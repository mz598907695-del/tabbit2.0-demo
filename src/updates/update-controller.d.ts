export type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'ready' | 'installing' | 'installed' | 'current' | 'error';
export interface UpdateState {
  phase: UpdatePhase;
  visible: boolean;
  version: string;
  received: number;
  total: number;
  error: '' | 'check' | 'download' | 'install' | 'restart';
}
interface UpdateCandidate {
  version: string;
  download: (onEvent: (event: import('@tauri-apps/plugin-updater').DownloadEvent) => void, options?: { timeout:number }) => Promise<void>;
  install: () => Promise<void>;
  close: () => Promise<void>;
}
export function createUpdateController(dependencies: {
  check: (options: { timeout:number }) => Promise<UpdateCandidate | null>;
  relaunch: () => Promise<void>;
}): {
  getSnapshot: () => UpdateState;
  subscribe: (listener: () => void) => () => void;
  checkForUpdates: (options?: { manual?:boolean }) => Promise<void>;
  installUpdate: () => Promise<void>;
  restart: () => Promise<void>;
  dismiss: () => void;
};
