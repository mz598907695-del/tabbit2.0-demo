// Run with `cargo run --release --example macos_exception_smoke`.
// Tests must use the release profile: `cargo test` always enables unwinding.
#[cfg(target_os = "macos")]
fn main() {
    use objc2::msg_send;
    use objc2_foundation::NSObject;

    let result = objc2::exception::catch(|| {
        let object = NSObject::new();
        // Deliberately raise a Cocoa exception, as WebKit can do for a stopped
        // video request. It must reach objc2's catch without aborting the app.
        unsafe {
            let _: () = msg_send![&object, deliberatelyMissingVideoRegressionSelector];
        }
    });
    assert!(result.is_err(), "Expected the Cocoa exception to be caught");
    println!("Release Cocoa exception handling passed");
}

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("Cocoa exception smoke check is macOS-only");
}
