import { analyzeSamples, frequencyBands } from './audio-visualizer-data.js';

export const EMPTY_AUDIO_FRAME = { level: 0, peak: 0, rms: 0, dbfs: -Infinity, bands: Array(32).fill(0), volume: null, muted: null, deviceName: '' };
const aborted = () => Object.assign(new Error('Audio monitoring canceled'), { name: 'AbortError' });
const quietly = action => { try { action(); } catch { /* Cleanup must release the remaining resources too. */ } };

/** Analyze a live stream without recording or routing it to speakers. */
export async function monitorAudioStream(stream, onFrame, onEnd, {
  signal,
  AudioContext: Context = globalThis.AudioContext || globalThis.webkitAudioContext,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  const tracks = stream.getTracks();
  let context, analyser, input, animation = null, lastFrame = 0, closed = false, interrupt;
  const interruption = new Promise((_, reject) => { interrupt = reject; });
  // Initialization can fail before resume() joins the race.
  void interruption.catch(() => {});
  const clean = () => {
    if (closed) return;
    closed = true;
    if (animation !== null) quietly(() => cancelFrame?.(animation));
    signal?.removeEventListener('abort', stop);
    tracks.forEach(track => {
      quietly(() => track.removeEventListener('ended', ended));
      quietly(() => track.stop());
    });
    quietly(() => input?.disconnect());
    quietly(() => analyser?.disconnect());
    if (context) quietly(() => { void Promise.resolve(context.close()).catch(() => {}); });
  };
  const stop = () => { clean(); interrupt(aborted()); };
  const ended = () => {
    if (closed) return;
    const error = Object.assign(new Error('audio_stream_stopped'), { code: 'ended' });
    clean(); interrupt(error); onEnd?.(error);
  };
  try {
    if (signal?.aborted) throw aborted();
    signal?.addEventListener('abort', stop, { once: true });
    if (!Context || !requestFrame || !cancelFrame) throw Object.assign(new Error('Audio analysis is unavailable'), { code: 'unsupported' });
    if (!stream.getAudioTracks().length) throw Object.assign(new Error('No audio track selected'), { code: 'no-audio' });
    if (tracks.some(track => track.readyState === 'ended')) throw Object.assign(new Error('audio_stream_stopped'), { code: 'ended' });
    context = new Context();
    analyser = context.createAnalyser();
    analyser.fftSize = 2048; analyser.smoothingTimeConstant = .65;
    analyser.minDecibels = -90; analyser.maxDecibels = -10;
    input = context.createMediaStreamSource(stream);
    input.connect(analyser);
    tracks.forEach(track => track.addEventListener('ended', ended));
    const samples = new Float32Array(analyser.fftSize), frequencies = new Uint8Array(analyser.frequencyBinCount);
    // Aborting immediately rejects this promise even if resume never settles.
    await Promise.race([context.resume(), interruption]);
    if (closed || signal?.aborted) throw aborted();
    const tick = time => {
      if (closed) return;
      try {
        if (time - lastFrame >= 50) {
          lastFrame = time;
          analyser.getFloatTimeDomainData(samples); analyser.getByteFrequencyData(frequencies);
          onFrame({ ...EMPTY_AUDIO_FRAME, ...analyzeSamples(samples), bands: frequencyBands(frequencies, context.sampleRate, analyser.fftSize, 32), deviceName: stream.getAudioTracks()[0]?.label || '' });
        }
        if (!closed) animation = requestFrame(tick);
      } catch (error) { clean(); onEnd?.(error); }
    };
    animation = requestFrame(tick);
    return stop;
  } catch (error) { clean(); throw error; }
}

/** A read-only output-device watcher, independent from audio capture. */
export function watchAudioOutput(readOutput, onOutput, { interval = 500, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let closed = false, timer = null;
  const poll = async () => {
    let output = null;
    try {
      const value = await readOutput();
      if (value && !value.error && value.supported !== false) output = {
        volume: Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : null,
        muted: typeof value.muted === 'boolean' ? value.muted : null,
        deviceName: typeof value.deviceName === 'string' ? value.deviceName : '',
        supported: value.supported !== false,
      };
    } catch { /* Unsupported outputs are not capture errors. */ }
    if (closed) return;
    onOutput(output);
    if (!closed) timer = setTimer(poll, interval);
  };
  void poll();
  return () => { closed = true; if (timer !== null) clearTimer(timer); };
}

export function audioFailure(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  if (code === 'no-audio') return 'no-audio';
  if (code === 'unsupported' || /macos_14_2_required|macos_only|unsupported|not supported|14\.2/.test(`${code} ${message}`)) return 'unsupported';
  if (/no_audio_frames/.test(`${code} ${message}`)) return 'no-frames';
  if (code === 'ended' || /audio_stream_stopped|audio_session_inactive/.test(`${code} ${message}`)) return 'ended';
  if (/system_audio_start_failed/.test(`${code} ${message}`)) return 'system-start';
  if (['NotAllowedError', 'SecurityError'].includes(error?.name) || /permission|denied|not authorized/.test(message)) return 'permission';
  if (error?.name === 'NotFoundError') return 'no-device';
  if (error?.name === 'NotReadableError') return 'busy';
  return 'failed';
}
