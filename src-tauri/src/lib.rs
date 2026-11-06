#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg(target_os = "macos")]
#[derive(Clone, Copy)]
struct GlassState {
    tint: [u8; 4],
    clear: bool,
    opacity: f64,
    dark: bool,
}

#[cfg(target_os = "macos")]
fn glass_state() -> &'static std::sync::Mutex<GlassState> {
    static STATE: std::sync::OnceLock<std::sync::Mutex<GlassState>> = std::sync::OnceLock::new();
    STATE.get_or_init(|| std::sync::Mutex::new(GlassState {
        tint: [242, 247, 255, 128],
        clear: false,
        opacity: 0.6,
        dark: false,
    }))
}

#[cfg(target_os = "macos")]
fn dark_clear_tint(tint: [u8; 4]) -> [u8; 4] {
    // Keep the selected space hue, but anchor native clear glass to a dark
    // neutral so the backplate reads as dark instead of milky white.
    const BASE: [u16; 3] = [20, 22, 26];
    [
        ((tint[0] as u16 * 30 + BASE[0] * 70) / 100) as u8,
        ((tint[1] as u16 * 30 + BASE[1] * 70) / 100) as u8,
        ((tint[2] as u16 * 30 + BASE[2] * 70) / 100) as u8,
        tint[3],
    ]
}

#[cfg(target_os = "macos")]
fn configure_backplate(view: &objc2_app_kit::NSView, tint: [u8; 4], clear: bool, opacity: f64, dark: bool) -> Result<(), String> {
    use objc2_app_kit::{
        NSAnimationContext, NSAutoresizingMaskOptions, NSBox, NSBoxType,
        NSColor, NSTitlePosition, NSVisualEffectMaterial, NSVisualEffectState, NSVisualEffectView,
        NSAppKitVersionNumber, NSGlassEffectView, NSGlassEffectViewStyle, NSWindowOrderingMode,
    };
    use objc2_foundation::MainThreadMarker;

    let effect = view.viewWithTag(91376254).ok_or("Native backplate is missing")?;
    let effect = effect.downcast_ref::<NSVisualEffectView>().ok_or("Unexpected native backplate")?;
    let mtm = MainThreadMarker::new().ok_or("Backplate updates require the main thread")?;
    // Clear glass has its own native material; UnderWindowBackground is a
    // traditional frosted material and adds a gray base even without our tint.
    let native_clear = clear && unsafe { NSAppKitVersionNumber >= 2685.0 };
    let native_tint = if native_clear && dark { dark_clear_tint(tint) } else { tint };
    let color = NSColor::colorWithRed_green_blue_alpha(
        native_tint[0] as f64 / 255.0, native_tint[1] as f64 / 255.0,
        native_tint[2] as f64 / 255.0, native_tint[3] as f64 / 255.0,
    );
    if native_clear && view.viewWithTag(96945937).is_none() {
        let glass = unsafe { window_vibrancy::NSGlassEffectViewTagged::initWithFrame(mtm.alloc(), view.bounds(), 96945937) };
        glass.setStyle(NSGlassEffectViewStyle::Clear);
        glass.setCornerRadius(18.0);
        glass.setAutoresizingMask(NSAutoresizingMaskOptions::ViewWidthSizable | NSAutoresizingMaskOptions::ViewHeightSizable);
        view.addSubview_positioned_relativeTo(&glass, NSWindowOrderingMode::Below, None);
    }
    if let Some(glass) = view.viewWithTag(96945937) {
        let glass = glass.downcast_ref::<NSGlassEffectView>().ok_or("Unexpected clear backplate")?;
        glass.setHidden(!native_clear);
        if native_clear {
            glass.setTintColor(Some(&color));
            glass.setAlphaValue(if opacity.is_finite() { opacity.clamp(0.0, 1.0) } else { 1.0 });
        }
    }
    effect.setHidden(native_clear);
    if native_clear { return Ok(()); }
    NSAnimationContext::beginGrouping();
    let context = NSAnimationContext::currentContext();
    context.setDuration(0.0);
    context.setAllowsImplicitAnimation(false);
    // This public state stays active even when the window loses focus.
    effect.setState(NSVisualEffectState::Active);
    effect.setAlphaValue(if opacity.is_finite() { opacity.clamp(0.0, 1.0) } else { 0.6 });
    let material = if clear { NSVisualEffectMaterial::UnderWindowBackground } else { NSVisualEffectMaterial::Popover };
    if effect.material() != material { effect.setMaterial(material); }
    let children = effect.subviews();
    let mut has_overlay = false;
    for child in children.iter() {
        if let Some(overlay) = child.downcast_ref::<NSBox>() {
            overlay.setFillColor(&color);
            has_overlay = true;
            break;
        }
    }
    if !has_overlay {
        let overlay = NSBox::new(mtm);
        overlay.setBoxType(NSBoxType::Custom);
        overlay.setTitlePosition(NSTitlePosition::NoTitle);
        overlay.setBorderWidth(0.0);
        overlay.setTransparent(false);
        overlay.setFrame(effect.bounds());
        overlay.setAutoresizingMask(NSAutoresizingMaskOptions::ViewWidthSizable | NSAutoresizingMaskOptions::ViewHeightSizable);
        overlay.setFillColor(&color);
        effect.addSubview(&overlay);
    }
    NSAnimationContext::endGrouping();
    Ok(())
}

#[tauri::command]
fn update_glass(window: tauri::WebviewWindow, tint: [u8; 4], clear: bool, opacity: Option<f64>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let opacity = opacity.unwrap_or(0.6);
        let state = {
            let mut state = glass_state().lock().map_err(|error| error.to_string())?;
            state.tint = tint;
            state.clear = clear;
            state.opacity = opacity;
            *state
        };
        let target = window.clone();
        window.run_on_main_thread(move || unsafe {
            if let Ok(pointer) = target.ns_view() {
                let view = &*(pointer as *const objc2_app_kit::NSView);
                if let Err(error) = configure_backplate(view, state.tint, state.clear, state.opacity, state.dark) {
                    eprintln!("failed to update native backplate: {error}");
                }
            }
        }).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_window_appearance(window: tauri::WebviewWindow, appearance: String, resolved: String) -> Result<(), String> {
    let theme = match appearance.as_str() {
        "light" => Some(tauri::Theme::Light),
        "dark" => Some(tauri::Theme::Dark),
        "system" => None,
        _ => return Err("Invalid window appearance".into()),
    };
    let dark = match resolved.as_str() {
        "light" => false,
        "dark" => true,
        _ => return Err("Invalid resolved window appearance".into()),
    };
    window.set_theme(theme).map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    {
        let state = {
            let mut state = glass_state().lock().map_err(|error| error.to_string())?;
            state.dark = dark;
            *state
        };
        let target = window.clone();
        window.run_on_main_thread(move || unsafe {
            if let Ok(pointer) = target.ns_view() {
                let view = &*(pointer as *const objc2_app_kit::NSView);
                if let Err(error) = configure_backplate(view, state.tint, state.clear, state.opacity, state.dark) {
                    eprintln!("failed to update native backplate appearance: {error}");
                }
            }
        }).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn perform_switch_haptic() {
    use objc2_app_kit::{NSHapticFeedbackManager, NSHapticFeedbackPattern, NSHapticFeedbackPerformanceTime, NSHapticFeedbackPerformer};
    NSHapticFeedbackManager::defaultPerformer().performFeedbackPattern_performanceTime(
        NSHapticFeedbackPattern::Generic,
        NSHapticFeedbackPerformanceTime::Now,
    );
}

#[tauri::command]
fn page_switch_haptic(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        window.run_on_main_thread(perform_switch_haptic).map_err(|error| error.to_string())?;
        // AppKit exposes patterns but no intensity control. A tight cluster of
        // the strongest Generic pulse makes the threshold unmistakable while
        // still reading as one piece of feedback.
        std::thread::spawn(move || {
            for delay in [28_u64, 28] {
                std::thread::sleep(std::time::Duration::from_millis(delay));
                if let Err(error) = window.run_on_main_thread(perform_switch_haptic) {
                    eprintln!("failed to perform strong threshold haptic: {error}");
                    break;
                }
            }
        });
    }
    Ok(())
}

#[tauri::command]
fn record_swipe_trace(records: Vec<serde_json::Value>) -> Result<(), String> {
    if !cfg!(debug_assertions) { return Ok(()); }
    use std::io::Write;
    let path = std::env::temp_dir().join("tabbit-demo-swipe-trace.jsonl");
    let mut file = std::fs::OpenOptions::new().create(true).append(true).open(path).map_err(|e| e.to_string())?;
    for record in records.into_iter().take(256) {
        writeln!(file, "{}", record).map_err(|e| e.to_string())?;
    }
    Ok(())
}

const APP_ICON_BYTES: [&[u8]; 10] = [
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/1.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/2.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/3.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/4.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/5.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/6.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/7.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/8.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/9.png"),
    include_bytes!("../../public/personalized-home-2-0/asset/images/app-icons-dock/10.png"),
];

#[tauri::command]
fn set_app_icon(window: tauri::WebviewWindow, index: usize) -> Result<(), String> {
    let bytes = APP_ICON_BYTES.get(index.checked_sub(1).ok_or("Invalid app icon")?)
        .copied()
        .ok_or("Invalid app icon")?;
    #[cfg(target_os = "macos")]
    window.run_on_main_thread(move || {
        use objc2::{AllocAnyThread, MainThreadMarker};
        use objc2_app_kit::{NSApplication, NSImage};
        use objc2_foundation::NSData;

        let Some(mtm) = MainThreadMarker::new() else { return };
        let data = NSData::with_bytes(bytes);
        let Some(icon) = NSImage::initWithData(NSImage::alloc(), &data) else { return };
        let app = NSApplication::sharedApplication(mtm);
        unsafe { app.setApplicationIconImage(Some(&icon)) };
    }).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn install_trackpad_phases(window: tauri::WebviewWindow) {
    use block2::RcBlock;
    use objc2_app_kit::{NSEvent, NSEventMask, NSEventPhase};
    use std::ptr::NonNull;
    thread_local! {
        static MONITOR: std::cell::RefCell<Option<objc2::rc::Retained<objc2::runtime::AnyObject>>> = const { std::cell::RefCell::new(None) };
    }
    let contact_active = std::cell::Cell::new(false);
    let handler = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        let native = unsafe { event.as_ref() };
        let phase = native.phase();
        let momentum = native.momentumPhase();
        let state = if phase.contains(NSEventPhase::Began)
            || (phase.contains(NSEventPhase::Changed) && !contact_active.get()) {
            // A contact can begin outside the webview or resume without a Began
            // sample. Its first real Changed event must unlock a fresh swipe.
            contact_active.set(true);
            Some("began")
        } else if phase.contains(NSEventPhase::Cancelled) {
            contact_active.set(false);
            Some("cancelled")
        } else if phase.contains(NSEventPhase::Ended) {
            contact_active.set(false);
            Some("ended")
        } else if momentum.contains(NSEventPhase::Began) {
            Some("momentum")
        } else if momentum.contains(NSEventPhase::Ended) || momentum.contains(NSEventPhase::Cancelled) {
            Some("momentum-ended")
        } else { None };
        if let Some(state) = state {
            let script = format!("window.dispatchEvent(new CustomEvent('tabbit-trackpad-phase', {{detail:'{state}'}}))");
            if let Err(error) = window.eval(&script) {
                eprintln!("failed to forward trackpad phase: {error}");
            }
        }
        event.as_ptr()
    });
    let token = unsafe { NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::ScrollWheel, &handler) };
    MONITOR.with(|monitor| *monitor.borrow_mut() = token);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![update_glass, set_window_appearance, page_switch_haptic, record_swipe_trace, set_app_icon])
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem, MenuItemKind};
            let menu = Menu::default(app.handle())?;
            for entry in menu.items()? {
                if let MenuItemKind::Submenu(submenu) = entry {
                    for (index, item) in submenu.items()?.into_iter().enumerate() {
                        if let MenuItemKind::Predefined(predefined) = item {
                            if predefined.text()?.starts_with("Close") {
                                submenu.remove(&predefined)?;
                                let close_tab = MenuItem::with_id(app, "close-tab", "关闭标签页", true, Some("CmdOrCtrl+W"))?;
                                submenu.insert(&close_tab, index)?;
                            }
                        }
                    }
                }
            }
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                use tauri::Manager;
                if event.id().as_ref() == "close-tab" {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("window.dispatchEvent(new Event('tabbit-close-tab'))");
                    }
                }
            });
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    install_trackpad_phases(window.clone());
                    if let Err(error) = apply_vibrancy(
                        &window, NSVisualEffectMaterial::Popover,
                        Some(NSVisualEffectState::Active), Some(18.0),
                    ) {
                        eprintln!("failed to apply fixed-active native backplate: {error}");
                    } else if let Ok(pointer) = window.ns_view() {
                        unsafe {
                            let view = &*(pointer as *const objc2_app_kit::NSView);
                            if let Err(error) = configure_backplate(view, [242, 247, 255, 128], false, 0.6, false) {
                                eprintln!("failed to initialize native backplate: {error}");
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
