//! One local WebKit-window snapshot per interaction. No files, screen
//! recording permission, capture timer, or persistent native capture objects.

#[derive(serde::Deserialize)]
pub struct SnapshotRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[tauri::command]
pub async fn capture_shockwave_content(
    window: tauri::WebviewWindow,
    rect: SnapshotRect,
    pixel_ratio: f64,
) -> Result<tauri::ipc::Response, String> {
    if [rect.x, rect.y, rect.width, rect.height, pixel_ratio]
        .iter()
        .any(|v| !v.is_finite())
        || rect.width <= 0.0
        || rect.height <= 0.0
    {
        return Err("Invalid content snapshot bounds".into());
    }
    #[cfg(target_os = "macos")]
    {
        use block2::RcBlock;
        use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
        use objc2_foundation::{
            MainThreadMarker, NSDictionary, NSError, NSNumber, NSPoint, NSRect, NSSize,
        };
        use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};

        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let (sender, mut receiver) = tokio::sync::mpsc::channel(1);
        window
            .with_webview(move |platform| {
                let result = (|| -> Result<(), String> {
                    let mtm = MainThreadMarker::new().ok_or("Snapshot requires main thread")?;
                    let webview = unsafe { &*platform.inner().cast::<WKWebView>() };
                    let bounds = webview.bounds();
                    let x = rect.x.clamp(0.0, bounds.size.width);
                    let y = rect.y.clamp(0.0, bounds.size.height);
                    let width = rect.width.min(bounds.size.width - x);
                    let height = rect.height.min(bounds.size.height - y);
                    if width < 1.0 || height < 1.0 {
                        return Err("Content is outside the webview".into());
                    }
                    // Cap both scale and total pixel count for large desktop windows.
                    let ratio = pixel_ratio
                        .clamp(0.5, 2.0)
                        .min((4_000_000.0 / (width * height)).sqrt());
                    let config = unsafe { WKSnapshotConfiguration::new(mtm) };
                    unsafe {
                        config.setRect(NSRect::new(NSPoint::new(x, y), NSSize::new(width, height)));
                        config.setSnapshotWidth(Some(&NSNumber::new_f64(width * ratio / scale)));
                        // Read the currently presented page at press time; do
                        // not wait for the task UI or overlay's next paint.
                        config.setAfterScreenUpdates(false);
                    }
                    let completion_sender = sender.clone();
                    let completion =
                        RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
                            let result = (|| -> Result<Vec<u8>, String> {
                                if !error.is_null() {
                                    return Err("WebKit content capture failed".into());
                                }
                                let image =
                                    unsafe { image.as_ref() }.ok_or("Empty content snapshot")?;
                                let tiff = image
                                    .TIFFRepresentation()
                                    .ok_or("Snapshot bitmap unavailable")?;
                                let bitmap = NSBitmapImageRep::imageRepWithData(&tiff)
                                    .ok_or("Invalid snapshot bitmap")?;
                                let png = unsafe {
                                    bitmap.representationUsingType_properties(
                                        NSBitmapImageFileType::PNG,
                                        &NSDictionary::new(),
                                    )
                                }
                                .ok_or("Snapshot encoding failed")?;
                                Ok(png.to_vec())
                            })();
                            let _ = completion_sender.try_send(result);
                        });
                    unsafe {
                        webview.takeSnapshotWithConfiguration_completionHandler(
                            Some(&config),
                            &completion,
                        );
                    }
                    Ok(())
                })();
                if let Err(error) = result {
                    let _ = sender.try_send(Err(error));
                }
            })
            .map_err(|e| e.to_string())?;
        let result = tokio::time::timeout(std::time::Duration::from_secs(3), receiver.recv())
            .await
            .map_err(|_| "Content snapshot timed out")?
            .ok_or("Content snapshot cancelled")??;
        Ok(tauri::ipc::Response::new(result))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, rect, pixel_ratio);
        Err("Native content snapshots are unavailable on this platform".into())
    }
}
