use tauri::{Emitter, Manager};

#[cfg(target_os = "macos")]
thread_local! {
    static ACTIVE_MENU: std::cell::RefCell<Option<objc2::rc::Retained<objc2_app_kit::NSMenu>>> = const { std::cell::RefCell::new(None) };
}

fn finish_menu(app: &tauri::AppHandle) {
    if let Some(child) = app.get_webview("space-menu") { let _ = child.close(); }
    let _ = app.emit_to("main", "embedded-menu-closed", ());
}

#[tauri::command]
pub async fn open_embedded_menu(app: tauri::AppHandle, x: f64, y: f64, selected: usize, mode: String) -> Result<(), String> {
    if app.get_webview("space-menu").is_some() { return close_embedded_menu(app); }
    let window = app.get_window("main").ok_or("main window missing")?;
    let url = format!("index.html?embedded=space&selected={}&mode={}", selected.min(8), if mode == "vertical" { "vertical" } else { "horizontal" });
    let child = window.add_child(
        tauri::webview::WebviewBuilder::new("space-menu", tauri::WebviewUrl::App(url.into())).transparent(true),
        tauri::LogicalPosition::new(x, y), tauri::LogicalSize::new(230.0, 430.0)
    ).map_err(|e| e.to_string())?;
    child.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn embedded_menu_ready(webview: tauri::Webview, height: f64) -> Result<(), String> {
    if webview.label() != "space-menu" { return Err("invalid webview".into()); }
    webview.set_size(tauri::LogicalSize::new(230.0, height.clamp(100.0, 650.0))).map_err(|e| e.to_string())?;
    let app = webview.app_handle().clone();
    #[cfg(target_os = "macos")]
    webview.with_webview(move |platform| unsafe {
        use objc2::MainThreadMarker;
        use objc2_app_kit::{NSMenu, NSMenuItem, NSView};
        use objc2_foundation::{NSPoint, NSString};
        let view = &*(platform.inner() as *const NSView);
        let Some(parent) = view.superview() else { finish_menu(&app); return; };
        let Some(mtm) = MainThreadMarker::new() else { finish_menu(&app); return; };
        let original = view.frame();
        let location = NSPoint::new(original.origin.x, if parent.isFlipped() { original.origin.y } else { original.origin.y + original.size.height });
        let menu = NSMenu::initWithTitle(mtm.alloc(), &NSString::from_str("空间"));
        menu.setAutoenablesItems(false);
        menu.setShowsStateColumn(false);
        let item = NSMenuItem::new(mtm);
        item.setEnabled(true);
        view.removeFromSuperview();
        view.setFrameOrigin(NSPoint::new(0.0, 0.0));
        view.setHidden(false);
        item.setView(Some(view));
        menu.addItem(&item);
        ACTIVE_MENU.with(|active| *active.borrow_mut() = Some(menu.clone()));
        eprintln!("[space-menu] presenting NSMenu with custom content");
        // AppKit owns the material, panel, shadow and tracking loop.
        menu.popUpMenuPositioningItem_atLocation_inView(None, location, Some(&parent));
        ACTIVE_MENU.with(|active| *active.borrow_mut() = None);
        item.setView(None);
        view.removeFromSuperview();
        view.setFrame(original);
        parent.addSubview(view);
        view.setHidden(true);
        finish_menu(&app);
        eprintln!("[space-menu] NSMenu dismissed");
    }).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_embedded_menu(app: tauri::AppHandle) -> Result<(), String> {
    let target = app.clone();
    app.run_on_main_thread(move || {
        #[cfg(target_os = "macos")]
        {
            let menu = ACTIVE_MENU.with(|active| active.borrow().clone());
            if let Some(menu) = menu { menu.cancelTracking(); return; }
        }
        finish_menu(&target);
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn embedded_menu_action(app: tauri::AppHandle, action: String, value: String) -> Result<(), String> {
    app.emit_to("main", "embedded-menu-action", serde_json::json!({ "action": action, "value": value })).map_err(|e| e.to_string())?;
    close_embedded_menu(app)
}
