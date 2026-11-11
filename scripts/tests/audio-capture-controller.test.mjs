import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioCaptureController } from '../../src/personalized-home-2-0/board/audio-capture-controller.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function clock() {
  let serial = 0; const timers = new Map();
  return { timers, setTimer(callback, delay) { const id = ++serial; timers.set(id, { callback, delay }); return id; }, clearTimer(id) { timers.delete(id); },
    async next() { const entry = timers.entries().next().value; assert.ok(entry, 'expected a scheduled task'); timers.delete(entry[0]); entry[1].callback(); await flush(); return entry[1].delay; } };
}
function stream() {
  const track = { readyState: 'live', stops: 0, stop() { this.stops++; this.readyState = 'ended'; } };
  return { track, getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] };
}
function harness(options = {}) {
  const time = clock(), frames = [], states = [], calls = []; let ids = 0;
  const defaultInvoke = async command => command === 'audio_visualizer_sample' ? { active: true, level: .42, bands: Array(32).fill(.42) } : { active: true, waiting: true };
  const invoke = (command, args) => { calls.push({ command, ...args }); return (options.invoke || defaultInvoke)(command, args); };
  const settings = { native: true, ...time, ...options, invoke, createId: () => `lease-${++ids}`, onFrame: value => frames.push(value), onState: value => states.push(value) };
  const capture = createAudioCaptureController(settings);
  return { capture, settings, time, frames, states, calls, status: () => states.at(-1), count: command => calls.filter(call => call.command === command).length };
}
function fakeMonitor() {
  const sessions = [];
  const monitor = async (input, frame, end, { signal }) => {
    const session = { input, frame, end, closed: false };
    const stop = () => { if (!session.closed) { session.closed = true; input.getTracks().forEach(track => track.stop()); signal.removeEventListener('abort', stop); } };
    signal.addEventListener('abort', stop, { once: true }); sessions.push(session);
    return stop;
  };
  return { monitor, sessions };
}

test('automatic native capture runs only for an active visible enabled non-preview face', async () => {
  const h = harness();
  for (const options of [{ active: true, preview: true }, { preview: false, active: false }, { active: true, visible: false }, { visible: true, enabled: false }]) {
    h.capture.configure(options); assert.equal(h.time.timers.size, 0); assert.equal(h.calls.length, 0);
  }
  assert.equal(h.status().status, 'paused');
  h.capture.configure({ enabled: true }); assert.equal(h.count('audio_visualizer_start'), 0, 'automatic start is deferred');
  await h.time.next(); assert.equal(h.count('audio_visualizer_start'), 1); assert.equal(h.status().status, 'listening');
  h.capture.configure({ visible: false }); assert.equal(h.count('audio_visualizer_stop'), 1); assert.equal(h.time.timers.size, 0);
  h.capture.configure({ visible: true }); await h.time.next(); assert.equal(h.count('audio_visualizer_start'), 2);
  h.capture.configure({ active: false }); assert.equal(h.count('audio_visualizer_stop'), 2); assert.equal(h.time.timers.size, 0);
  h.capture.dispose();
});

test('StrictMode setup cleanup setup cancels the first automatic permission attempt', async () => {
  const h = harness(); h.capture.configure({ active: true }); h.capture.dispose();
  assert.equal(h.calls.length, 0); assert.equal(h.time.timers.size, 0);
  const replacement = createAudioCaptureController(h.settings); replacement.configure({ active: true });
  await h.time.next(); assert.equal(h.count('audio_visualizer_start'), 1); replacement.dispose();
  assert.equal(h.count('audio_visualizer_stop'), 1); assert.equal(h.time.timers.size, 0);
});

test('native no-frame warnings remain waiting without reconnecting and recover on real samples', async () => {
  let samples = 0;
  const h = harness({ invoke: async command => command === 'audio_visualizer_sample'
    ? ++samples < 4 ? { active: true, waiting: true, error: 'no_audio_frames', volume: .6 } : { active: true, waiting: false, level: .75, peak: .9, bands: Array(32).fill(.7) }
    : { active: true, waiting: true } });
  h.capture.configure({ active: true }); await h.time.next();
  for (let i = 0; i < 2; i++) { assert.deepEqual(h.status(), { status: 'waiting', error: '' }); assert.equal(await h.time.next(), 200); }
  await h.time.next(); assert.equal(h.status().status, 'listening'); assert.equal(h.frames.at(-1).level, .75);
  assert.equal(h.count('audio_visualizer_start'), 1); assert.equal(h.count('audio_visualizer_stop'), 0);
  h.capture.dispose();
});

test('a native no-frame rejection also waits, but start failures never loop across visibility changes', async () => {
  const waiting = harness({ invoke: async command => { if (command === 'audio_visualizer_sample') throw new Error('no_audio_frames'); return { active: true }; } });
  waiting.capture.configure({ active: true }); await waiting.time.next(); await waiting.time.next();
  assert.deepEqual(waiting.status(), { status: 'waiting', error: '' }); assert.equal(waiting.count('audio_visualizer_start'), 1); waiting.capture.dispose();
  const failed = harness({ invoke: async command => { if (command === 'audio_visualizer_start') throw new Error('system_audio_start_failed:-50'); return {}; } });
  failed.capture.configure({ active: true }); await failed.time.next();
  assert.deepEqual(failed.status(), { status: 'error', error: 'system-start' }); assert.equal(failed.time.timers.size, 0);
  failed.capture.configure({ visible: false }); failed.capture.configure({ visible: true });
  assert.equal(failed.count('audio_visualizer_start'), 1); assert.equal(failed.time.timers.size, 0);
  await failed.capture.start(); assert.equal(failed.count('audio_visualizer_start'), 2, 'only an explicit retry reconnects'); failed.capture.dispose();
});

test('ended native sessions reconnect only once and stop after a second failure', async () => {
  const h = harness({ invoke: async command => command === 'audio_visualizer_sample' ? { active: false, error: 'audio_stream_stopped' } : { active: true } });
  h.capture.configure({ active: true }); await h.time.next(); assert.equal(h.status().status, 'requesting');
  assert.equal(await h.time.next(), 600); assert.equal(h.count('audio_visualizer_start'), 2);
  assert.deepEqual(h.status(), { status: 'error', error: 'ended' }); assert.equal(h.time.timers.size, 0);
  h.capture.configure({ active: false }); h.capture.configure({ active: true }); assert.equal(h.time.timers.size, 0);
  h.capture.dispose();
});

test('a late native start is released by its own lease after switching to a microphone', async () => {
  const initial = deferred(), mic = stream(), monitor = fakeMonitor();
  const h = harness({ invoke: (command) => command === 'audio_visualizer_start' ? initial.promise : Promise.resolve({}), permissions: { query: async () => ({ state: 'granted' }) }, mediaDevices: { getUserMedia: async () => mic }, monitor: monitor.monitor });
  h.capture.configure({ active: true }); await h.time.next(); assert.equal(h.status().status, 'requesting');
  h.capture.stop(); h.capture.configure({ source: 'microphone' }); await h.time.next();
  assert.equal(h.status().status, 'listening'); assert.equal(monitor.sessions[0].closed, false);
  initial.resolve({ active: true }); await flush();
  assert.equal(h.status().status, 'listening'); assert.equal(mic.track.stops, 0);
  assert.deepEqual(h.calls.filter(call => call.command === 'audio_visualizer_stop').map(call => call.clientId), ['lease-1', 'lease-1']);
  h.capture.dispose(); assert.equal(mic.track.stops, 1);
});

test('late native samples are ignored after hiding and the next visible session has a new lease', async () => {
  const sample = deferred(); let samples = 0;
  const h = harness({ invoke: command => command === 'audio_visualizer_sample' && samples++ === 0 ? sample.promise : Promise.resolve({ active: true, level: .2 }) });
  h.capture.configure({ active: true }); await h.time.next(); h.capture.configure({ visible: false });
  const hiddenFrames = h.frames.length; sample.resolve({ active: true, level: 1 }); await flush();
  assert.equal(h.frames.length, hiddenFrames); assert.equal(h.time.timers.size, 0);
  h.capture.configure({ visible: true }); await h.time.next();
  assert.deepEqual(h.calls.filter(call => call.command === 'audio_visualizer_start').map(call => call.clientId), ['lease-1', 'lease-2']);
  assert.equal(h.frames.at(-1).level, .2); h.capture.dispose();
});

test('web system capture never prompts automatically and explicit start preserves user activation', async () => {
  const shared = stream(), monitor = fakeMonitor(); let requests = 0;
  const h = harness({ native: false, mediaDevices: { getDisplayMedia() { requests++; return Promise.resolve(shared); } }, monitor: monitor.monitor });
  h.capture.configure({ active: true }); await h.time.next(); assert.deepEqual(h.status(), { status: 'needs-source', error: '' }); assert.equal(requests, 0);
  const start = h.capture.start(); assert.equal(requests, 1, 'getDisplayMedia must be called in the same user-action stack'); await start;
  assert.equal(h.status().status, 'listening');
  h.capture.configure({ visible: false }); assert.equal(shared.track.stops, 1);
  h.capture.configure({ visible: true }); await h.time.next(); assert.equal(requests, 1); assert.equal(h.status().status, 'needs-source'); h.capture.dispose();
});

test('pending browser sharing is requested once and a late selected stream is released without monitoring', async () => {
  const picker = deferred(), shared = stream(), monitor = fakeMonitor(); let requests = 0;
  const h = harness({ native: false, mediaDevices: { getDisplayMedia() { requests++; return picker.promise; } }, monitor: monitor.monitor });
  h.capture.configure({ active: true });
  const first = h.capture.start(), duplicate = h.capture.start(); assert.equal(requests, 1); assert.equal(first, duplicate);
  h.capture.stop(); picker.resolve(shared); await first;
  assert.equal(shared.track.stops, 1); assert.equal(monitor.sessions.length, 0); assert.equal(h.status().status, 'paused');
  assert.equal(h.time.timers.size, 0); h.capture.dispose();
});

test('microphones auto-start only with granted permission and resume after returning', async () => {
  let permission = 'prompt', requests = 0; const streams = [], monitor = fakeMonitor();
  const h = harness({ native: false, permissions: { query: async ({ name }) => { assert.equal(name, 'microphone'); return { state: permission }; } }, mediaDevices: { getUserMedia: async () => { requests++; const input = stream(); streams.push(input); return input; } }, monitor: monitor.monitor });
  h.capture.configure({ source: 'microphone', active: true }); await h.time.next(); assert.equal(requests, 0); assert.equal(h.status().status, 'needs-source');
  permission = 'granted'; await h.capture.start(); assert.equal(requests, 1); assert.equal(h.status().status, 'listening');
  h.capture.configure({ visible: false }); assert.equal(streams[0].track.stops, 1);
  h.capture.configure({ visible: true }); await h.time.next(); assert.equal(requests, 2); h.capture.dispose();
});

test('unknown or denied microphone permission waits for an explicit action without a popup loop', async () => {
  for (const permissions of [undefined, { query: async () => { throw new Error('unsupported query'); } }, { query: async () => ({ state: 'denied' }) }]) {
    let requests = 0;
    const h = harness({ native: false, permissions, mediaDevices: { getUserMedia: async () => { requests++; throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); } } });
    h.capture.configure({ source: 'microphone', active: true }); await h.time.next(); assert.equal(requests, 0); assert.equal(h.status().status, 'needs-source');
    await h.capture.start(); assert.equal(requests, 1); assert.deepEqual(h.status(), { status: 'error', error: 'permission' });
    h.capture.configure({ visible: false }); h.capture.configure({ visible: true }); assert.equal(h.time.timers.size, 0); assert.equal(requests, 1); h.capture.dispose();
  }
});

test('stale permission checks and aborted analysis cannot resurrect a changed source', async () => {
  const permission = deferred(), input = stream(); let requests = 0, aborts = 0;
  const h = harness({ native: false, permissions: { query: () => permission.promise }, mediaDevices: { getUserMedia: async () => { requests++; return input; } }, monitor: (_stream, _frame, _end, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborts++; input.track.stop(); reject(Object.assign(new Error('canceled'), { name: 'AbortError' })); }, { once: true });
  }) });
  h.capture.configure({ source: 'microphone', active: true }); await h.time.next(); h.capture.configure({ source: 'system' });
  permission.resolve({ state: 'granted' }); await flush(); assert.equal(requests, 0); await h.time.next(); assert.equal(h.status().status, 'needs-source');
  h.capture.configure({ source: 'microphone' }); const starting = h.capture.start(); await flush(); assert.equal(requests, 1);
  h.capture.configure({ enabled: false }); await starting; assert.equal(aborts, 1); assert.equal(h.status().status, 'paused'); assert.equal(h.time.timers.size, 0); h.capture.dispose();
});

test('disposal clears a scheduled reconnect and suppresses later monitor frames', async () => {
  const input = stream(), monitor = fakeMonitor();
  const h = harness({ native: false, permissions: { query: async () => ({ state: 'granted' }) }, mediaDevices: { getUserMedia: async () => input }, monitor: monitor.monitor });
  h.capture.configure({ active: true, source: 'microphone' }); await h.time.next();
  monitor.sessions[0].end(Object.assign(new Error('audio_stream_stopped'), { code: 'ended' })); assert.equal(h.time.timers.size, 1);
  h.capture.dispose(); const count = h.frames.length;
  monitor.sessions[0].frame({ level: 1 }); assert.equal(h.frames.length, count); assert.equal(h.time.timers.size, 0);
});
