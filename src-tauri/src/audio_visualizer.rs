//! Visibility-scoped system-audio visualization. PCM never leaves this process:
//! the webview receives only 32 spectral magnitudes and meter/volume values.
use serde::Serialize;

const SAMPLE_COUNT: usize = 1024;
const BAND_COUNT: usize = 32;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputStatus {
    pub supported: bool,
    pub volume: Option<f32>,
    pub muted: Option<bool>,
    pub device_name: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSample {
    pub active: bool,
    pub waiting: bool,
    pub level: f32,
    pub rms: f32,
    pub peak: f32,
    pub dbfs: f32,
    pub bands: Vec<f32>,
    pub volume: Option<f32>,
    pub muted: Option<bool>,
    pub device_name: Option<String>,
    pub sample_rate: Option<f64>,
    pub sequence: u64,
    pub error: Option<String>,
}

impl AudioSample {
    fn empty(output: OutputStatus, active: bool, error: Option<String>) -> Self {
        Self {
            active,
            waiting: active,
            level: 0.0,
            rms: 0.0,
            peak: 0.0,
            dbfs: -96.0,
            bands: vec![0.0; BAND_COUNT],
            volume: output.volume,
            muted: output.muted,
            device_name: output.device_name,
            sample_rate: None,
            sequence: 0,
            error,
        }
    }
}

fn valid_client(client_id: &str) -> bool {
    !client_id.is_empty() && client_id.len() <= 160 && !client_id.chars().any(char::is_control)
}

fn amplitude_dbfs(value: f32) -> f32 {
    if !value.is_finite() || value <= 0.0 {
        -96.0
    } else {
        (20.0 * value.log10()).clamp(-96.0, 0.0)
    }
}

fn display_level(dbfs: f32) -> f32 {
    ((dbfs + 60.0) / 60.0).clamp(0.0, 1.0)
}

// Radix-2 FFT with a Hann window. Both channels contribute power separately,
// so opposite-phase stereo audio does not disappear through mono cancellation.
fn channel_power(samples: &[f32; SAMPLE_COUNT]) -> [f32; SAMPLE_COUNT / 2] {
    let mut real = [0.0_f32; SAMPLE_COUNT];
    let mut imag = [0.0_f32; SAMPLE_COUNT];
    let mut window_sum = 0.0;
    for (i, value) in samples.iter().enumerate() {
        let window =
            0.5 - 0.5 * (std::f32::consts::TAU * i as f32 / (SAMPLE_COUNT - 1) as f32).cos();
        real[i] = if value.is_finite() {
            value * window
        } else {
            0.0
        };
        window_sum += window;
    }
    let mut j = 0;
    for i in 1..SAMPLE_COUNT {
        let mut bit = SAMPLE_COUNT >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            real.swap(i, j);
            imag.swap(i, j);
        }
    }
    let mut length = 2;
    while length <= SAMPLE_COUNT {
        let angle = -std::f32::consts::TAU / length as f32;
        let (sin, cos) = angle.sin_cos();
        for offset in (0..SAMPLE_COUNT).step_by(length) {
            let (mut wr, mut wi) = (1.0, 0.0);
            for index in 0..length / 2 {
                let a = offset + index;
                let b = a + length / 2;
                let tr = wr * real[b] - wi * imag[b];
                let ti = wr * imag[b] + wi * real[b];
                real[b] = real[a] - tr;
                imag[b] = imag[a] - ti;
                real[a] += tr;
                imag[a] += ti;
                let next_wr = wr * cos - wi * sin;
                wi = wr * sin + wi * cos;
                wr = next_wr;
            }
        }
        length <<= 1;
    }
    let mut power = [0.0; SAMPLE_COUNT / 2];
    let gain = 2.0 / window_sum;
    for i in 1..SAMPLE_COUNT / 2 {
        power[i] = (real[i] * real[i] + imag[i] * imag[i]) * gain * gain;
    }
    power
}

fn spectrum(left: &[f32; SAMPLE_COUNT], right: &[f32; SAMPLE_COUNT], sample_rate: f64) -> Vec<f32> {
    if !sample_rate.is_finite() || sample_rate <= 0.0 {
        return vec![0.0; BAND_COUNT];
    }
    let left = channel_power(left);
    let right = channel_power(right);
    let resolution = sample_rate as f32 / SAMPLE_COUNT as f32;
    let low = resolution.max(40.0);
    let high = (sample_rate as f32 * 0.5).min(16000.0).max(low);
    (0..BAND_COUNT)
        .map(|band| {
            let from = low * (high / low).powf(band as f32 / BAND_COUNT as f32);
            let to = low * (high / low).powf((band + 1) as f32 / BAND_COUNT as f32);
            let start = ((from / resolution).floor() as usize).clamp(1, SAMPLE_COUNT / 2 - 1);
            let end = ((to / resolution).ceil() as usize).clamp(start + 1, SAMPLE_COUNT / 2);
            let power = (start..end)
                .map(|i| (left[i] + right[i]) * 0.5)
                .fold(0.0_f32, f32::max);
            display_level(amplitude_dbfs(power.sqrt()))
        })
        .collect()
}

#[cfg(target_os = "macos")]
mod native {
    use super::*;
    use std::{
        collections::HashMap,
        ffi::CStr,
        sync::{Mutex, Once, OnceLock},
        time::{Duration, Instant},
    };

    #[repr(C)]
    struct NativeOutput {
        device_id: u32,
        volume_known: i32,
        mute_known: i32,
        muted: i32,
        volume: f32,
        device_name: [std::ffi::c_char; 256],
    }
    #[repr(C)]
    struct NativeFrame {
        sequence: u64,
        sample_rate: f64,
        sample_count: u32,
        channels: u32,
        rms: f32,
        peak: f32,
        left: [f32; SAMPLE_COUNT],
        right: [f32; SAMPLE_COUNT],
    }
    unsafe extern "C" {
        fn tb_audio_supported() -> i32;
        fn tb_audio_output(output: *mut NativeOutput) -> i32;
        fn tb_audio_start() -> i32;
        fn tb_audio_stop();
        fn tb_audio_sample(frame: *mut NativeFrame) -> i32;
    }

    pub fn output() -> OutputStatus {
        let mut output: NativeOutput = unsafe { std::mem::zeroed() };
        let status = unsafe { tb_audio_output(&mut output) };
        let name = unsafe { CStr::from_ptr(output.device_name.as_ptr()) }
            .to_string_lossy()
            .into_owned();
        OutputStatus {
            supported: unsafe { tb_audio_supported() != 0 },
            volume: (status == 0 && output.volume_known != 0).then_some(output.volume),
            muted: (status == 0 && output.mute_known != 0).then_some(output.muted != 0),
            device_name: (!name.is_empty()).then_some(name),
            error: (status != 0).then(|| format!("output_device_unavailable:{status}")),
        }
    }

    struct Session {
        clients: HashMap<String, Instant>,
        running: bool,
        started: Instant,
        last_sequence: u64,
        last_frame: Instant,
        output: OutputStatus,
        output_at: Instant,
    }
    impl Session {
        fn new() -> Self {
            let now = Instant::now();
            Self {
                clients: HashMap::new(),
                running: false,
                started: now,
                last_sequence: 0,
                last_frame: now,
                output: output(),
                output_at: now,
            }
        }
        fn refresh_output(&mut self) {
            if self.output_at.elapsed() >= Duration::from_millis(250) {
                self.output = output();
                self.output_at = Instant::now();
            }
        }
        fn stop_if_empty(&mut self) {
            if self.running && self.clients.is_empty() {
                unsafe {
                    tb_audio_stop();
                }
                self.running = false;
                self.last_sequence = 0;
            }
        }
    }
    fn session() -> &'static Mutex<Session> {
        static SESSION: OnceLock<Mutex<Session>> = OnceLock::new();
        SESSION.get_or_init(|| Mutex::new(Session::new()))
    }
    fn watchdog() {
        static ONCE: Once = Once::new();
        ONCE.call_once(|| {
            std::thread::Builder::new()
                .name("audio-client-leases".into())
                .spawn(|| {
                    loop {
                        std::thread::sleep(Duration::from_secs(1));
                        if let Ok(mut state) = session().lock() {
                            // A reload, closed webview, or crashed JS client cannot keep
                            // system-audio access alive indefinitely.
                            state.clients.retain(|_, last_seen| {
                                last_seen.elapsed() < Duration::from_secs(8)
                            });
                            state.stop_if_empty();
                        }
                    }
                })
                .expect("audio lease watchdog");
        });
    }
    pub fn start(client_id: String) -> Result<AudioSample, String> {
        if !valid_client(&client_id) {
            return Err("invalid_client_id".into());
        }
        watchdog();
        let mut state = session().lock().map_err(|_| "audio_state_unavailable")?;
        state.refresh_output();
        if !state.output.supported {
            return Ok(AudioSample::empty(
                state.output.clone(),
                false,
                Some("macos_14_2_required".into()),
            ));
        }
        if !state.running {
            let status = unsafe { tb_audio_start() };
            if status != 0 {
                return Ok(AudioSample::empty(
                    state.output.clone(),
                    false,
                    Some(format!("system_audio_start_failed:{status}")),
                ));
            }
            state.running = true;
            state.started = Instant::now();
            state.last_frame = state.started;
            state.last_sequence = 0;
        }
        state.clients.insert(client_id, Instant::now());
        Ok(AudioSample::empty(state.output.clone(), true, None))
    }
    pub fn sample(client_id: String) -> Result<AudioSample, String> {
        if !valid_client(&client_id) {
            return Err("invalid_client_id".into());
        }
        let mut state = session().lock().map_err(|_| "audio_state_unavailable")?;
        state.refresh_output();
        if !state.running || !state.clients.contains_key(&client_id) {
            return Ok(AudioSample::empty(
                state.output.clone(),
                false,
                Some("audio_session_inactive".into()),
            ));
        }
        state.clients.insert(client_id, Instant::now());
        let mut frame: NativeFrame = unsafe { std::mem::zeroed() };
        if unsafe { tb_audio_sample(&mut frame) } == 0 {
            state.clients.clear();
            state.stop_if_empty();
            return Ok(AudioSample::empty(
                state.output.clone(),
                false,
                Some("audio_stream_stopped".into()),
            ));
        }
        let fresh = frame.sequence != state.last_sequence;
        if fresh {
            state.last_sequence = frame.sequence;
            state.last_frame = Instant::now();
        }
        let waiting =
            frame.sequence == 0 || state.last_frame.elapsed() > Duration::from_millis(500);
        if waiting {
            let error = (state.last_frame.elapsed() > Duration::from_secs(10))
                .then(|| "no_audio_frames".to_string());
            return Ok(AudioSample::empty(state.output.clone(), true, error));
        }
        let output = state.output.clone();
        // FFT happens outside the control lock. It never runs in the realtime IO callback.
        drop(state);
        let rms = frame.rms.clamp(0.0, 1.0);
        let dbfs = amplitude_dbfs(rms);
        Ok(AudioSample {
            active: true,
            waiting: false,
            level: display_level(dbfs),
            rms,
            peak: frame.peak.clamp(0.0, 1.0),
            dbfs,
            bands: spectrum(&frame.left, &frame.right, frame.sample_rate),
            volume: output.volume,
            muted: output.muted,
            device_name: output.device_name,
            sample_rate: Some(frame.sample_rate),
            sequence: frame.sequence,
            error: None,
        })
    }
    pub fn stop(client_id: String) -> Result<(), String> {
        if !valid_client(&client_id) {
            return Err("invalid_client_id".into());
        }
        let mut state = session().lock().map_err(|_| "audio_state_unavailable")?;
        state.clients.remove(&client_id);
        state.stop_if_empty();
        Ok(())
    }
}

pub fn read_output_status() -> OutputStatus {
    #[cfg(target_os = "macos")]
    {
        native::output()
    }
    #[cfg(not(target_os = "macos"))]
    {
        OutputStatus {
            supported: false,
            volume: None,
            muted: None,
            device_name: None,
            error: Some("macos_only".into()),
        }
    }
}

/// Read-only: does not create a tap or request any recording permission.
#[tauri::command]
pub fn audio_visualizer_output() -> OutputStatus {
    read_output_status()
}

#[tauri::command]
pub async fn audio_visualizer_start(client_id: String) -> Result<AudioSample, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || native::start(client_id))
            .await
            .map_err(|error| error.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = client_id;
        Ok(AudioSample::empty(
            read_output_status(),
            false,
            Some("macos_only".into()),
        ))
    }
}

#[tauri::command]
pub async fn audio_visualizer_sample(client_id: String) -> Result<AudioSample, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || native::sample(client_id))
            .await
            .map_err(|error| error.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = client_id;
        Ok(AudioSample::empty(
            read_output_status(),
            false,
            Some("macos_only".into()),
        ))
    }
}

#[tauri::command]
pub async fn audio_visualizer_stop(client_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || native::stop(client_id))
            .await
            .map_err(|error| error.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = client_id;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn meter_uses_dbfs_and_true_silence() {
        assert_eq!(amplitude_dbfs(0.0), -96.0);
        assert_eq!(display_level(-96.0), 0.0);
        assert_eq!(display_level(-60.0), 0.0);
        assert!((display_level(-30.0) - 0.5).abs() < 0.0001);
        assert_eq!(display_level(0.0), 1.0);
        assert_eq!(amplitude_dbfs(f32::NAN), -96.0);
    }
    #[test]
    fn silence_has_no_synthetic_spectrum() {
        let bands = spectrum(&[0.0; SAMPLE_COUNT], &[0.0; SAMPLE_COUNT], 48000.0);
        assert_eq!(bands, vec![0.0; BAND_COUNT]);
    }
    #[test]
    fn real_tone_moves_frequency_and_survives_opposite_stereo_phase() {
        let tone = |bin: usize| {
            std::array::from_fn(|i| {
                0.5 * (std::f32::consts::TAU * bin as f32 * i as f32 / SAMPLE_COUNT as f32).sin()
            })
        };
        let low = tone(20);
        let high = tone(160);
        let opposite = low.map(|value| -value);
        let low_bands = spectrum(&low, &opposite, 48000.0);
        let high_bands = spectrum(&high, &high, 48000.0);
        let peak = |values: &[f32]| {
            values
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.total_cmp(b.1))
                .unwrap()
                .0
        };
        assert!(peak(&high_bands) > peak(&low_bands));
        assert!(low_bands[peak(&low_bands)] > 0.85);
        assert!(
            low_bands
                .iter()
                .chain(high_bands.iter())
                .all(|value| value.is_finite() && (0.0..=1.0).contains(value))
        );
    }
    #[test]
    fn client_names_are_bounded() {
        assert!(valid_client("audio-widget-1"));
        assert!(!valid_client(""));
        assert!(!valid_client("a\nb"));
        assert!(!valid_client(&"x".repeat(161)));
    }
}
