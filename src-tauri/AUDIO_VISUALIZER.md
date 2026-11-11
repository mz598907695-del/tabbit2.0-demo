# Native audio visualizer

The macOS implementation uses a private, unmuted Core Audio process tap on
macOS 14.2 or later. It does not change the default output device or its volume,
record a file, capture the screen, or send PCM to JavaScript. A 1024-sample stereo
window stays in memory; Rust computes 32 logarithmic spectral bands off the audio
IO thread. Stopping the last client destroys the IO callback, aggregate device,
and tap, and clears the buffers.

## Frontend commands

- `audio_visualizer_start({ clientId })`: automatically called for a visible,
  active audio widget with detection enabled; returns an initial sample and may
  cause the macOS system-audio permission prompt on first connection.
- `audio_visualizer_sample({ clientId })`: poll around every 50 ms while visible.
- `audio_visualizer_stop({ clientId })`: call when stopping, unmounting, or hiding.
- `audio_visualizer_output()`: read-only device-volume query; never creates a tap
  or requests recording permission.

Clients share one capture. Each distinct `clientId` has a lease, renewed by
sampling; stopping one client leaves the others running. If a client vanishes
without stopping, its lease expires after eight seconds.

Samples contain `active`, `waiting`, `level`, `rms`, `peak`, `dbfs`, `bands[32]`,
`volume`, `muted`, `deviceName`, `sampleRate`, `sequence`, and `error`. `level` and
bands map -60 to 0 dBFS onto 0 to 1; true zero has `dbfs: -96`. PCM measurements
and device output-volume controls are separate: the tap is not a sound-pressure
measurement, and the device-volume scalar is not a recorded signal level.
HDMI and other fixed-output devices can legitimately report `volume: null` or
`muted: null` while still supplying audio samples.

Waiting for initial PCM returns `active: true`, `waiting: true`, `error: null`.
Ten seconds without callbacks yields `no_audio_frames`; silence received in real
callbacks continues advancing `sequence` and remains active. The absence of
callbacks alone does not establish that permission was denied. The frontend
keeps polling this waiting state so playback can resume without another click.

Other errors: `macos_14_2_required`, `audio_session_inactive`,
`audio_stream_stopped`, and `system_audio_start_failed:<OSStatus>`. Present a
localized user-facing explanation; retain native OSStatus only for diagnostics.

## Permission packaging

`Info.plist` includes `NSAudioCaptureUsageDescription` and
`NSMicrophoneUsageDescription`. Tauri embeds this file into development binaries
and merges it into app bundles. `Entitlements.plist` grants audio input for the
optional WebAudio microphone source without enabling the App Sandbox. The
existing Wry WKWebView supports microphone media capture; macOS authorization
still belongs to the user. Catalog previews and inactive/hidden widgets do not
capture audio. A visible audio widget connects automatically, releases its source
when hidden or paused, and reconnects when visible again. A permission/startup
failure is latched instead of repeatedly reopening an authorization request.

The browser fallback cannot auto-open `getDisplayMedia`: the browser requires a
user gesture and fresh source selection. Its card shows a waiting state, and the
details panel offers source selection. Previously authorized microphone input
can reconnect automatically; otherwise authorization is requested from details.

## Validation

Run `cargo check`, `cargo test --lib audio_visualizer::tests`, and the read-only
`cargo run --example audio_output_smoke` from `src-tauri`. The tests cover the
dBFS mapping, true-silence spectrum, frequency position, opposite-phase stereo,
and client ID bounds. The smoke query has read a real output-device name,
volume, and mute state. Both privacy descriptions were also verified in the
development executable's `__TEXT,__info_plist` section.

This validation intentionally does not start a tap or accept privacy prompts.
End-to-end system-audio capture must be checked after the user grants access.
No release bundle or deployment was produced for this change.

Apple references:

- [Core Audio taps](https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps)
- [System-audio usage description](https://developer.apple.com/documentation/bundleresources/information-property-list/nsaudiocaptureusagedescription)
- [Microphone authorization](https://developer.apple.com/documentation/bundleresources/requesting-authorization-for-media-capture-on-macos)
