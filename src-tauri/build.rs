fn main() {
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=Info.plist");
    println!("cargo:rerun-if-changed=Entitlements.plist");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rerun-if-changed=src/audio_capture.m");
        println!("cargo:rerun-if-changed=src/audio_capture.h");
        cc::Build::new()
            .file("src/audio_capture.m")
            .flag("-fobjc-arc")
            .flag("-Wno-deprecated-declarations")
            .compile("tabbit_audio_capture");
        println!("cargo:rustc-link-lib=framework=CoreAudio");
        println!("cargo:rustc-link-lib=framework=AudioToolbox");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
    tauri_build::build()
}
