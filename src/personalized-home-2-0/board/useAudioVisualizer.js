import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EMPTY_AUDIO_FRAME, watchAudioOutput } from './audio-monitor.js';
import { createAudioCaptureController } from './audio-capture-controller.js';

export { EMPTY_AUDIO_FRAME, audioFailure, monitorAudioStream } from './audio-monitor.js';
export const isNativeAudio = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useAudioVisualizer({ source = 'system', active = true, preview = false, enabled = true }) {
  const [frame, setFrame] = useState(EMPTY_AUDIO_FRAME), [state, setState] = useState({ status: 'idle', error: '' });
  const [output, setOutput] = useState(null), [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const controller = useRef(null), outputSession = useRef(null);
  useEffect(() => {
    const capture = createAudioCaptureController({ native: isNativeAudio(), invoke, onFrame: setFrame, onState: setState });
    controller.current = capture;
    return () => { capture.dispose(); if (controller.current === capture) controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.configure({ source, active, preview, enabled, visible }); }, [source, active, preview, enabled, visible]);
  useEffect(() => {
    const hide = () => {
      outputSession.current?.(); outputSession.current = null;
      controller.current?.configure({ visible: false });
      setVisible(false); setOutput(null);
    };
    const visibility = () => {
      if (document.hidden) hide();
      else { controller.current?.configure({ visible: true }); setVisible(true); }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', visibility); };
  }, []);
  useEffect(() => {
    setOutput(null);
    if (source !== 'system' || !isNativeAudio() || !active || preview || !enabled || !visible || document.hidden) return;
    const stopOutput = watchAudioOutput(() => invoke('audio_visualizer_output'), setOutput);
    outputSession.current = stopOutput;
    return () => { stopOutput(); if (outputSession.current === stopOutput) outputSession.current = null; };
  }, [source, active, preview, enabled, visible]);
  const start = useCallback(() => controller.current?.start(), []);
  const stop = useCallback(() => controller.current?.stop(), []);
  return { frame, status: state.status, error: state.error, output, start, stop };
}
