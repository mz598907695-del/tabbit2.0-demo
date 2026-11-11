fn main() {
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=Info.plist");
    println!("cargo:rerun-if-changed=Entitlements.plist");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rerun-if-changed=src/audio_capture.m");
        println!("cargo:rerun-if-changed=src/audio_capture.h");
        let mut audio = cc::Build::new();
        audio
            .file("src/audio_capture.m")
            .flag("-fobjc-arc")
            .flag("-Wno-deprecated-declarations");
        let compiler = audio.get_compiler();
        let runtime = std::process::Command::new(compiler.path())
            .arg("-print-file-name=libclang_rt.osx.a")
            .output()
            .expect("failed to locate the macOS Clang runtime");
        let runtime = String::from_utf8(runtime.stdout)
            .expect("the macOS Clang runtime path was not UTF-8");
        let runtime = runtime.trim();
        if !runtime.is_empty() && std::path::Path::new(runtime).is_file() {
            // Rust links with -nodefaultlibs, so availability checks emitted by
            // Objective-C do not receive Clang's runtime automatically.
            println!("cargo:rustc-link-arg={runtime}");
        } else {
            panic!("the macOS Clang runtime was not found: {runtime}");
        }
        audio.compile("tabbit_audio_capture");
        println!("cargo:rustc-link-lib=framework=CoreAudio");
        println!("cargo:rustc-link-lib=framework=AudioToolbox");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
    tauri_build::build()
}
