import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSamples, frequencyBands } from '../../src/personalized-home-2-0/board/audio-visualizer-data.js';
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const sine = (amplitude, count = 2048, cycles = 16) => Float32Array.from({length: count}, (_, index) => amplitude * Math.sin(2 * Math.PI * cycles * index / count));

test('empty, absent and digital-silence buffers produce exact zeros and negative-infinite dBFS', () => {
  for (const input of [undefined, null, [], new DataView(new ArrayBuffer(4)), new Float32Array(), new Float32Array(2048)]) {
    assert.deepEqual(analyzeSamples(input), {rms: 0, peak: 0, dbfs: -Infinity, level: 0});
  }
});
test('known sine amplitude has measured RMS and dBFS, not its peak or calibrated dB SPL', () => {
  const full = analyzeSamples(sine(1));
  near(full.peak, 1);
  near(full.rms, Math.SQRT1_2);
  near(full.dbfs, -3.0102999566);
  near(full.level, (60 - 3.0102999566) / 60);
  const half = analyzeSamples(sine(0.5));
  near(half.rms, Math.SQRT1_2 / 2);
  near(half.dbfs, -9.0308998699);
  near(full.dbfs - half.dbfs, 6.0205999133);
});
test('clipped square waves and over-full-scale samples keep real measurements but cap visual level', () => {
  assert.deepEqual(analyzeSamples(new Float32Array([-1, 1, -1, 1])), {rms: 1, peak: 1, dbfs: 0, level: 1});
  const overload = analyzeSamples(new Float32Array([-2, 2]));
  assert.equal(overload.rms, 2);
  assert.equal(overload.peak, 2);
  near(overload.dbfs, 6.0205999133);
  assert.equal(overload.level, 1);
  const impulse = analyzeSamples(new Float32Array([1, 0, 0, 0]));
  assert.equal(impulse.rms, 0.5);
  assert.equal(impulse.peak, 1);
});
test('invalid samples are zero-filled, input stays immutable, quiet signal is not fabricated', () => {
  const input = new Float32Array([NaN, Infinity, -Infinity, 1]);
  const result = analyzeSamples(input);
  assert.equal(result.rms, 0.5);
  assert.equal(result.peak, 1);
  assert.ok(Number.isNaN(input[0]));
  const quiet = analyzeSamples(new Float32Array([0.0001, -0.0001]));
  near(quiet.dbfs, -80, 1e-4);
  assert.equal(quiet.level, 0);
  assert.deepEqual(analyzeSamples(sine(0.2)), analyzeSamples(sine(0.2)));
});
test('RMS calculation remains finite for very large finite sample values', () => {
  const result = analyzeSamples(new Float64Array([1e300, -1e300]));
  assert.equal(result.rms, 1e300);
  assert.equal(result.peak, 1e300);
  assert.equal(result.dbfs, 6000);
  assert.equal(result.level, 1);
});
test('FFT silence, absent input and invalid metadata return deterministic zero bands', () => {
  for (const input of [undefined, null, [], new Uint8Array(), new Uint8Array(1024)]) {
    assert.deepEqual(frequencyBands(input, 48000, 2048), Array(32).fill(0));
  }
  for (const [rate, fft] of [[0, 2048], [NaN, 2048], [Infinity, 2048], [48000, 17], [48000, 2000], [48000, 65536]]) {
    assert.deepEqual(frequencyBands(new Uint8Array(1024).fill(255), rate, fft, 16), Array(16).fill(0));
  }
});
test('peak pooling is normalized, deterministic and does not mutate FFT input', () => {
  const input = new Uint8Array(1024).fill(128), before = input.slice();
  const result = frequencyBands(input, 48000, 2048, 32);
  assert.ok(result.every(value => value === 128 / 255));
  assert.deepEqual(input, before);
  assert.deepEqual(result, frequencyBands(input, 48000, 2048, 32));
  assert.ok(frequencyBands(new Uint8Array(1024).fill(255), 48000, 2048).every(value => value === 1));
});
test('equal-frequency tones land in matching logarithmic regions at different FFT resolutions', () => {
  const tones = [250, 1000, 8000];
  const peaks = tones.map(hz => {
    const input = new Uint8Array(2048);
    input[Math.round(hz / (48000 / 4096))] = 255;
    const bands = frequencyBands(input, 48000, 4096);
    const expected = Math.floor(Math.log(hz / 20) / Math.log(20000 / 20) * 32);
    const active = bands.flatMap((value, i) => value > 0 ? [i] : []);
    assert.ok(active.length > 0);
    assert.ok(active.every(index => Math.abs(index - expected) <= 1));
    return active[0];
  });
  assert.ok(peaks[0] < peaks[1] && peaks[1] < peaks[2]);
  const other = new Uint8Array(4096);
  other[Math.round(1000 / (44100 / 8192))] = 200;
  const active = frequencyBands(other, 44100, 8192).findIndex(value => value > 0);
  assert.ok(Math.abs(active - peaks[1]) <= 1);
});
test('DC is excluded, unavailable bins stay zero and count is safely bounded', () => {
  const dc = new Uint8Array(1024); dc[0] = 255;
  assert.ok(frequencyBands(dc, 48000, 2048).every(value => value === 0));
  const short = new Uint8Array([0,255]);
  const result = frequencyBands(short, 48000, 2048);
  assert.ok(result[0] > 0);
  assert.equal(result.at(-1), 0);
  assert.deepEqual(frequencyBands(dc, 48000, 2048, 0), []);
  assert.equal(frequencyBands(dc, 48000, 2048, Infinity).length, 32);
  assert.equal(frequencyBands(dc, 48000, 2048, 1e9).length, 256);
  assert.equal(frequencyBands(dc, 48000, 2048, 8.9).length, 8);
});
