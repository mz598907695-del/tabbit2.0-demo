/**
 * Deterministic audio measurements. No devices, timers, storage or randomness.
 * Input: AnalyserNode.getFloatTimeDomainData / getByteFrequencyData buffers.
 * https://www.w3.org/TR/webaudio/#AnalyserNode
 *
 * Values describe digital sample amplitude, NOT calibrated acoustic dB SPL.
 * A full-scale sine has RMS 1 / sqrt(2), therefore about -3.01 dBFS here.
 */
const LEVEL_FLOOR_DBFS = -60;
const clamp01 = value => Math.min(1, Math.max(0, value));
const isNumericBuffer = value => ArrayBuffer.isView(value) && typeof value.length === 'number';

/**
 * rms / peak preserve actual linear amplitude, including floating-point values
 * above nominal full scale. Invalid samples contribute zero to the same window.
 * dbfs is 20 * log10(rms); exact silence returns -Infinity, never a fake floor.
 * level is the display-only [-60, 0] dBFS range normalized to [0, 1].
 */
export function analyzeSamples(samples) {
  if (!isNumericBuffer(samples) || samples.length === 0) return { rms: 0, peak: 0, dbfs: -Infinity, level: 0 };
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    if (Number.isFinite(value)) peak = Math.max(peak, Math.abs(value));
  }
  if (peak === 0) return { rms: 0, peak: 0, dbfs: -Infinity, level: 0 };
  // Scale before squaring to avoid overflow for unexpected over-range input.
  let squared = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    if (Number.isFinite(value)) squared += (value / peak) ** 2;
  }
  const rms = peak * Math.sqrt(squared / samples.length);
  const dbfs = 20 * Math.log10(rms);
  return { rms, peak, dbfs, level: clamp01((dbfs - LEVEL_FLOOR_DBFS) / -LEVEL_FLOOR_DBFS) };
}

/**
 * Peak-pool FFT bytes into logarithmic bands from max(20 Hz, one FFT bin) to
 * min(20 kHz, Nyquist). Bin k represents k * sampleRate / fftSize Hz; DC (k=0)
 * is excluded. Low bands narrower than FFT resolution share their nearest
 * available bin instead of inventing new spectral information.
 *
 * AnalyserNode bytes already map its configured minDecibels..maxDecibels to
 * 0..255. These results are those relative levels / 255, NOT physical energy,
 * dB SPL, or an RMS of logarithmic bytes. Zero input always produces zero.
 * Missing/invalid buffers or metadata produce zero bands. Count is bounded
 * to 0..256 to keep a misconfigured card from allocating unbounded memory.
 */
export function frequencyBands(bytes, sampleRate, fftSize, count = 32) {
  const size = Number.isFinite(count) ? Math.min(256, Math.max(0, Math.trunc(count))) : 32;
  const bands = Array(size).fill(0);
  if (!size || !(bytes instanceof Uint8Array) || !bytes.length || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isInteger(fftSize) || fftSize < 32 || fftSize > 32768 || (fftSize & (fftSize - 1)) !== 0) return bands;
  const bins = Math.min(bytes.length, fftSize / 2);
  if (bins <= 1) return bands;
  const binHz = sampleRate / fftSize;
  const lowHz = Math.max(20, binHz);
  const highHz = Math.min(20_000, sampleRate / 2);
  if (!(highHz > lowHz)) return bands;
  const ratio = highHz / lowHz;
  for (let band = 0; band < size; band += 1) {
    const startHz = lowHz * ratio ** (band / size);
    const endHz = lowHz * ratio ** ((band + 1) / size);
    const start = Math.max(1, Math.floor(startHz / binHz));
    const end = Math.min(bins, Math.max(start + 1, Math.ceil(endHz / binHz)));
    let peak = 0;
    for (let bin = start; bin < end; bin += 1) peak = Math.max(peak, bytes[bin]);
    bands[band] = clamp01(peak / 255);
  }
  return bands;
}
