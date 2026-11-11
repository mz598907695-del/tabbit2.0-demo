// Isolated native updater probe: production HTTPS or loopback fixture HTTP.
// Usage: cargo run --example updater_smoke -- URL TEMP_FIXTURE_APP CASE
// Never creates a webview, launches the user app, or reads its localStorage.
use std::path::PathBuf;
use tauri_plugin_updater::UpdaterExt;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let endpoint = args.get(1).ok_or("Missing updater endpoint")?;
    let fixture = PathBuf::from(args.get(2).ok_or("Missing temporary app fixture")?);
    let case = args.get(3).ok_or("Missing probe case")?;
    let loopback = endpoint.starts_with("http://127.0.0.1:");
    if fixture.file_name().and_then(|s| s.to_str()) != Some("Tabbit Updater Smoke.app")
        || !fixture.canonicalize()?.starts_with(std::env::temp_dir().canonicalize()?)
    {
        return Err("Probe can only replace its dedicated temporary fixture".into());
    }
    let mut context = tauri::generate_context!();
    let mut settings = context.config().plugins.0.get("updater").ok_or("Updater configuration missing")?.clone();
    if !loopback && settings["endpoints"][0].as_str() != Some(endpoint.as_str()) {
        return Err("Probe endpoints must use loopback or the configured production HTTPS address".into());
    }
    let expected_version = context.package_info().version.to_string();
    context.package_info_mut().version = "0.1.1".parse()?;
    context.config_mut().identifier = "com.tabbit.demo.updater-smoke".into();
    context.config_mut().app.windows.clear();
    settings["endpoints"] = serde_json::json!([endpoint]);
    if loopback {
        settings["dangerousInsecureTransportProtocol"] = serde_json::json!(true);
    }
    context.config_mut().plugins.0.insert("updater".into(), settings);
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)?;
    let builder = app.updater_builder()
        .executable_path(fixture.join("Contents/MacOS/tabbit-2-demo"))
        .timeout(std::time::Duration::from_secs(90));
    let updater = if loopback { builder.no_proxy() } else { builder }.build()?;
    tauri::async_runtime::block_on(async {
        let update = updater.check().await?;
        if case == "current" {
            if update.is_some() { return Err("Expected no update".into()); }
        } else {
            let update = update.ok_or("Expected a newer release")?;
            let result = update.download(|_, _| {}, || {}).await;
            if case == "tampered" || case == "wrong-version" {
                if result.is_ok() { return Err("Invalid update unexpectedly passed verification".into()); }
                let error = result.err().unwrap().to_string();
                let expected = if case == "wrong-version" { "version" } else { "signature" };
                if !error.to_lowercase().contains(expected) {
                    return Err(format!("Unexpected verification failure: {error}").into());
                }
            } else if case == "valid" {
                update.install(result?)?;
                let version = std::process::Command::new("/usr/libexec/PlistBuddy")
                    .args(["-c", "Print :CFBundleShortVersionString"])
                    .arg(fixture.join("Contents/Info.plist"))
                    .output()?;
                if !version.status.success() || String::from_utf8_lossy(&version.stdout).trim() != expected_version {
                    return Err("Installed bundle version mismatch".into());
                }
                if !std::process::Command::new("codesign").args(["--verify", "--deep", "--strict"]).arg(&fixture).status()?.success() {
                    return Err("Installed bundle signature is invalid".into());
                }
            } else { return Err("Unknown probe case".into()); }
        }
        println!("Updater native probe passed: {case}");
        Ok::<(), Box<dyn std::error::Error>>(())
    })
}
