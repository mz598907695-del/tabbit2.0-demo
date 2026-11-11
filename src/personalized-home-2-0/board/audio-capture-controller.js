import { EMPTY_AUDIO_FRAME, audioFailure, monitorAudioStream } from './audio-monitor.js';

/** Own one capture lease. Automatic attempts never request browser sharing or
 * ungranted microphone access; only start() may use a user activation. */
export function createAudioCaptureController({
  native = false,
  invoke,
  mediaDevices = globalThis.navigator?.mediaDevices,
  permissions = globalThis.navigator?.permissions,
  monitor = monitorAudioStream,
  onFrame = () => {},
  onState = () => {},
  createId = () => globalThis.crypto.randomUUID(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  reconnectDelay = 600,
} = {}) {
  let config = { source: 'system', active: false, preview: false, visible: true, enabled: true };
  let disposed = false, generation = 0, release = null, scheduled = null, phase = null, pending = null;
  let manuallyPaused = false, retries = 0;
  const blocked = new Map();
  const eligible = () => !disposed && config.active && !config.preview && config.visible && config.enabled && !manuallyPaused;
  const publish = (status, error = '') => { if (!disposed) onState({ status, error }); };
  const clearSchedule = () => { if (scheduled !== null) clearTimer(scheduled); scheduled = null; };
  const cancel = () => {
    generation++; clearSchedule();
    const cleanup = release; release = null; phase = null;
    cleanup?.();
  };
  const resetFrame = () => { if (!disposed) onFrame(EMPTY_AUDIO_FRAME); };
  const quietStopNative = clientId => { try { void Promise.resolve(invoke('audio_visualizer_stop', { clientId })).catch(() => {}); } catch { /* A stale lease must not affect its successor. */ } };
  const schedule = delay => {
    clearSchedule();
    scheduled = setTimer(() => { scheduled = null; if (eligible()) void begin(false); }, delay);
  };
  const fail = (failure, token, source) => {
    if (disposed || token !== generation) return;
    const reason = audioFailure(failure);
    cancel(); resetFrame();
    if (reason === 'ended' && eligible() && (native && source === 'system' || source === 'microphone') && retries < 1) {
      retries++; publish('requesting'); schedule(reconnectDelay); return;
    }
    if (source === 'system' && !native && reason === 'ended') {
      publish('needs-source', 'ended'); return;
    }
    blocked.set(source, reason); publish('error', reason);
  };
  async function capture(manual, token, source) {
    const current = () => !disposed && generation === token && eligible() && config.source === source;
    try {
      if (source === 'system' && native) {
        const clientId = createId(); let closed = false, pollTimer = null;
        const cleanup = () => {
          if (closed) return;
          closed = true; if (pollTimer !== null) clearTimer(pollTimer);
          quietStopNative(clientId);
        };
        release = cleanup;
        const initial = await invoke('audio_visualizer_start', { clientId });
        // stop() may have run before this asynchronous native start acquired its
        // lease. Release again after it resolves, using only this attempt's id.
        if (!current()) { quietStopNative(clientId); return; }
        if (initial?.active === false || initial?.error && audioFailure(initial.error) !== 'no-frames') throw new Error(initial.error || 'audio_session_inactive');
        phase = 'running'; publish(initial?.waiting === false ? 'listening' : 'waiting');
        const poll = async () => {
          if (closed || !current()) return;
          let waiting = false;
          try {
            const value = await invoke('audio_visualizer_sample', { clientId });
            if (closed || !current()) return;
            if (!value || value.active === false) throw new Error(value?.error && audioFailure(value.error) !== 'no-frames' ? value.error : 'audio_stream_stopped');
            const reason = value.error ? audioFailure(value.error) : '';
            if (reason && reason !== 'no-frames') throw new Error(value.error);
            waiting = value.waiting === true || reason === 'no-frames';
            onFrame(waiting ? { ...EMPTY_AUDIO_FRAME, volume: value.volume ?? null, muted: value.muted ?? null, deviceName: value.deviceName || '' } : { ...EMPTY_AUDIO_FRAME, ...value });
            publish(waiting ? 'waiting' : 'listening');
          } catch (failure) {
            if (closed || !current()) return;
            // Some bridge versions reject instead of returning a waiting frame.
            if (audioFailure(failure) !== 'no-frames') { fail(failure, token, source); return; }
            waiting = true; resetFrame(); publish('waiting');
          }
          if (!closed && current()) pollTimer = setTimer(poll, waiting ? 200 : 50);
        };
        void poll();
        return;
      }
      if (!manual) {
        if (source === 'system') { phase = null; publish('needs-source'); return; }
        let permission;
        try { permission = await permissions?.query({ name: 'microphone' }); } catch { /* Unknown permission must be granted by an explicit action. */ }
        if (!current()) return;
        if (permission?.state !== 'granted') { phase = null; publish('needs-source', permission?.state === 'denied' ? 'permission' : ''); return; }
      }
      if (!mediaDevices || (source === 'system' ? !mediaDevices.getDisplayMedia : !mediaDevices.getUserMedia)) throw Object.assign(new Error('Unsupported audio capture'), { code: 'unsupported' });
      const abort = new AbortController(); let stream, stopMonitor, monitoring = false, cleaned = false;
      release = () => {
        if (cleaned) return;
        cleaned = true; abort.abort();
        if (stopMonitor) stopMonitor();
        else if (!monitoring) stream?.getTracks().forEach(track => track.stop());
      };
      stream = source === 'system'
        ? await mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: 'include', windowAudio: 'system', selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude' })
        : await mediaDevices.getUserMedia({ video: false, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      if (!stream.getAudioTracks().length) throw Object.assign(new Error('No audio track selected'), { code: 'no-audio' });
      // Sharing requires video, but its pixels are never read or recorded.
      stream.getVideoTracks?.().forEach(track => { track.enabled = false; });
      monitoring = true;
      stopMonitor = await monitor(stream, value => {
        if (current()) { onFrame(value); publish('listening'); }
      }, failure => { if (current()) fail(failure || Object.assign(new Error('audio_stream_stopped'), { code: 'ended' }), token, source); }, { signal: abort.signal });
      if (!current()) { stopMonitor(); return; }
      phase = 'running'; publish('listening');
    } catch (failure) { fail(failure, token, source); }
  }
  function begin(manual) {
    if (disposed || !config.active || config.preview || !config.visible) return Promise.resolve();
    if (manual) {
      if (phase === 'starting') return pending || Promise.resolve();
      manuallyPaused = false; config = { ...config, enabled: true };
      blocked.delete(config.source); retries = 0;
    }
    if (!eligible()) return Promise.resolve();
    if (!manual && blocked.has(config.source)) { publish('error', blocked.get(config.source)); return Promise.resolve(); }
    cancel(); resetFrame(); phase = 'starting'; publish('requesting');
    const token = generation, source = config.source;
    pending = capture(manual, token, source);
    return pending;
  }
  const configure = changes => {
    if (disposed) return;
    const next = { ...config, ...changes }, sourceChanged = next.source !== config.source;
    const changed = Object.keys(next).some(key => next[key] !== config[key]);
    if (!changed) return;
    const resumed = !config.enabled && next.enabled;
    config = next;
    if (sourceChanged || resumed) { manuallyPaused = false; retries = 0; }
    if (resumed) blocked.delete(config.source);
    if (!eligible()) {
      cancel(); resetFrame(); publish(!config.enabled || manuallyPaused ? 'paused' : 'idle'); return;
    }
    if (sourceChanged) { cancel(); resetFrame(); }
    if (phase === 'starting' || phase === 'running') return;
    if (blocked.has(config.source)) { publish('error', blocked.get(config.source)); return; }
    // Deferring only automatic starts makes StrictMode's setup/cleanup/setup
    // cancel the first attempt before it can show an OS permission prompt.
    schedule(0);
  };
  const stop = () => { if (!disposed) { manuallyPaused = true; cancel(); resetFrame(); publish('paused'); } };
  const dispose = () => { if (!disposed) { disposed = true; cancel(); } };
  return { configure, start: () => begin(true), stop, dispose };
}
