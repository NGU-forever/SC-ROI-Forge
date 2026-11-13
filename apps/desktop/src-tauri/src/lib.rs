use tauri_plugin_shell::ShellExt;

/// Try to spawn the packaged `sc-roi-api` sidecar (PyInstaller follow-up).
/// MVP: binary may be absent; devs often start uvicorn separately — see README.
fn try_spawn_api_sidecar(handle: &tauri::AppHandle) {
    let shell = handle.shell();
    match shell.sidecar("sc-roi-api") {
        Ok(cmd) => {
            if let Err(err) = cmd.spawn() {
                eprintln!("[sc-roi-forge] sc-roi-api sidecar failed to spawn: {err}");
            } else {
                println!("[sc-roi-forge] sc-roi-api sidecar spawned (expected 127.0.0.1:8000)");
            }
        }
        Err(err) => {
            eprintln!(
                "[sc-roi-forge] sc-roi-api sidecar not bundled (MVP ok): {err}. See apps/desktop/README.md"
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            try_spawn_api_sidecar(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SC ROI Forge desktop");
}
