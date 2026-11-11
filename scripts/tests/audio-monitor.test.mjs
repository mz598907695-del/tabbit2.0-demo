import test from 'node:test';
import assert from 'node:assert/strict';
import { audioFailure, monitorAudioStream, watchAudioOutput } from '../../src/personalized-home-2-0/board/audio-monitor.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function media({ failure, resume = Promise.resolve() } = {}) {
  const stats = { constructed: 0, closed: 0, trackStops: 0, inputDisconnects: 0, analyserDisconnects: 0 }, frames = new Map();
  let nextFrame = 0;
  class Track extends EventTarget { label = 'Test input'; readyState = 'live'; stop() { stats.trackStops++; this.readyState = 'ended'; } }
  const track = new Track(), stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const analyser = { frequencyBinCount: 1024, disconnect() { stats.analyserDisconnects++; }, getFloatTimeDomainData(samples) { samples.fill(.5); }, getByteFrequencyData(bytes) { bytes.fill(128); } };
  class Context {
    sampleRate = 48000;
    constructor() { if (failure === 'constructor') throw new Error('constructor failed'); stats.constructed++; }
    createAnalyser() { if (failure === 'analyser') throw new Error('analyser failed'); return analyser; }
    createMediaStreamSource() {
      if (failure === 'source') throw new Error('source failed');
      return { connect(target) { assert.equal(target, analyser, 'capture must only connect to the analyser'); if (failure === 'connect') throw new Error('connect failed'); }, disconnect() { stats.inputDisconnects++; } };
    }
    resume() { return resume; }
    close() { stats.closed++; return Promise.resolve(); }
  }
  return { stats, stream, track, frames, options: { AudioContext: Context, requestFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; }, cancelFrame: id => frames.delete(id) }, tick(time) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(time); } };
}

test('abort while resume is pending rejects promptly and releases the whole graph', { timeout: 1000 }, async () => {
  const resume = deferred(), mock = media({ resume: resume.promise }), controller = new AbortController();
  const monitoring = monitorAudioStream(mock.stream, () => assert.fail('must not emit'), () => assert.fail('abort is not track ending'), { ...mock.options, signal: controller.signal });
  controller.abort();
  await assert.rejects(monitoring, { name: 'AbortError' });
  assert.deepEqual(mock.stats, { constructed: 1, closed: 1, trackStops: 1, inputDisconnects: 1, analyserDisconnects: 1 });
  assert.equal(mock.frames.size, 0);
  resume.resolve(); await flush();
  assert.equal(mock.stats.closed, 1); assert.equal(mock.frames.size, 0);
});

test('already aborted monitoring never creates a context and releases its stream', async () => {
  const mock = media(), controller = new AbortController(); controller.abort();
  await assert.rejects(monitorAudioStream(mock.stream, () => {}, () => {}, { ...mock.options, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(mock.stats.constructed, 0); assert.equal(mock.stats.trackStops, 1);
});

test('constructor and each graph initialization failure clean all acquired resources', async () => {
  for (const failure of ['constructor', 'analyser', 'source', 'connect']) {
    const mock = media({ failure });
    await assert.rejects(monitorAudioStream(mock.stream, () => {}, () => {}, mock.options), new RegExp(failure));
    assert.equal(mock.stats.trackStops, 1, failure);
    assert.equal(mock.stats.closed, failure === 'constructor' ? 0 : 1, failure);
    assert.equal(mock.frames.size, 0, failure);
  }
  const mock = media({ resume: Promise.reject(new Error('resume failed')) });
  await assert.rejects(monitorAudioStream(mock.stream, () => {}, () => {}, mock.options), /resume failed/);
  assert.equal(mock.stats.closed, 1); assert.equal(mock.stats.trackStops, 1);
});

test('track ending during resume rejects, notifies once and leaves no future callback', async () => {
  const pending = deferred(), mock = media({ resume: pending.promise }), endings = [];
  const monitoring = monitorAudioStream(mock.stream, () => assert.fail('must not emit'), error => endings.push(error), mock.options);
  mock.track.dispatchEvent(new Event('ended'));
  await assert.rejects(monitoring, /audio_stream_stopped/);
  mock.track.dispatchEvent(new Event('ended'));
  assert.equal(endings.length, 1); assert.equal(mock.stats.closed, 1);
  pending.resolve(); await flush(); assert.equal(mock.frames.size, 0);
});

test('independent monitors consume real samples and stopping one leaves the other live', async () => {
  const a = media(), b = media(), valuesA = [], valuesB = [];
  const stopA = await monitorAudioStream(a.stream, value => valuesA.push(value), () => {}, a.options);
  const stopB = await monitorAudioStream(b.stream, value => valuesB.push(value), () => {}, b.options);
  a.tick(50); b.tick(50);
  assert.equal(valuesA[0].rms, .5); assert.equal(valuesA[0].deviceName, 'Test input');
  assert.equal(valuesA[0].bands.length, 32);
  stopA(); stopA(); assert.equal(a.stats.closed, 1); assert.equal(a.frames.size, 0);
  assert.equal(b.stats.closed, 0); b.tick(100); assert.equal(valuesB.length, 2);
  stopB(); assert.equal(b.frames.size, 0);
});

test('abort removes the ended listener and cannot notify a later capture session', async () => {
  const mock = media(), controller = new AbortController(); let ended = 0;
  await monitorAudioStream(mock.stream, () => {}, () => ended++, { ...mock.options, signal: controller.signal });
  controller.abort(); mock.track.dispatchEvent(new Event('ended'));
  assert.equal(ended, 0); assert.equal(mock.stats.closed, 1);
});

test('read-only output watcher is serial, changes with hardware volume and cancels late output', async () => {
  const first = deferred(), second = deferred(), third = deferred(), readings = [], timers = new Map(); let reads = 0, timerId = 0;
  const pending = [first, second, third];
  const stop = watchAudioOutput(() => pending[reads++].promise, value => readings.push(value), {
    setTimer: (callback, delay) => { assert.equal(delay, 500); const id = ++timerId; timers.set(id, callback); return id; }, clearTimer: id => timers.delete(id),
  });
  assert.equal(reads, 1); assert.equal(timers.size, 0);
  first.resolve({ volume: .42, muted: false, deviceName: 'Speakers', supported: true }); await flush();
  assert.equal(readings[0].volume, .42); assert.equal(timers.size, 1);
  const [id, poll] = timers.entries().next().value; timers.delete(id); void poll();
  assert.equal(reads, 2); assert.equal(timers.size, 0);
  second.resolve({ volume: .8, muted: false }); await flush();
  assert.equal(readings[1].volume, .8);
  const [nextId, nextPoll] = timers.entries().next().value; timers.delete(nextId); void nextPoll();
  stop(); third.resolve({ volume: .1 }); await flush();
  assert.equal(readings.length, 2); assert.equal(timers.size, 0);
});

test('unsupported or failed hardware output yields null without a capture error', async () => {
  for (const read of [async () => { throw new Error('unavailable'); }, async () => ({ error: 'macos_only' }), async () => ({ supported: false })]) {
    const readings = [], stop = watchAudioOutput(read, value => readings.push(value), { setTimer: () => 1, clearTimer: () => {} });
    await flush(); assert.deepEqual(readings, [null]); stop();
  }
});

test('native failure codes preserve their cause instead of claiming every start failure is denial', () => {
  for (const code of ['macos_14_2_required', 'macos_only']) assert.equal(audioFailure(new Error(code)), 'unsupported');
  assert.equal(audioFailure(new Error('no_audio_frames')), 'no-frames');
  for (const code of ['audio_stream_stopped', 'audio_session_inactive']) assert.equal(audioFailure(new Error(code)), 'ended');
  assert.equal(audioFailure(new Error('system_audio_start_failed: permission unknown')), 'system-start');
  assert.equal(audioFailure({ name: 'NotAllowedError' }), 'permission');
  assert.equal(audioFailure({ name: 'NotFoundError' }), 'no-device');
  assert.equal(audioFailure({ name: 'NotReadableError' }), 'busy');
});
