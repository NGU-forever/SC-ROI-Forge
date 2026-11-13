use std::sync::Mutex;

use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

struct ApiSidecar(Mutex<Option<CommandChild>>);

fn try_spawn_api_sidecar(handle: &AppHandle) {
    let shell = handle.shell();
    match shell.sidecar("sc-roi-api") {
        Ok(cmd) => match cmd.spawn() {
            Ok((_rx, child)) => {
                if let Some(state) = handle.try_state::<ApiSidecar>() {
                    *state.0.lock().expect("sidecar mutex") = Some(child);
                }
                println!("[sc-roi-forge] sc-roi-api sidecar spawned (127.0.0.1:8000)");
            }
            Err(err) => {
                eprintln!("[sc-roi-forge] sc-roi-api sidecar failed to spawn: {err}");
            }
        },
        Err(err) => {
            eprintln!(
                "[sc-roi-forge] sc-roi-api sidecar not bundled: {err}. See apps/desktop/README.md"
            );
        }
    }
}

fn kill_api_sidecar(handle: &AppHandle) {
    if let Some(state) = handle.try_state::<ApiSidecar>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                if let Err(err) = child.kill() {
                    eprintln!("[sc-roi-forge] failed to stop sc-roi-api: {err}");
                } else {
                    println!("[sc-roi-forge] sc-roi-api sidecar stopped");
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ApiSidecar(Mutex::new(None)))
        .setup(|app| {
            try_spawn_api_sidecar(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building SC ROI Forge desktop")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                kill_api_sidecar(&app_handle);
            }
        });
}
