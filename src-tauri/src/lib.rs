use std::time::Duration;
use tauri::Manager;
use std::thread::sleep;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        let window = window.clone();

        tauri::async_runtime::spawn(async move {
          sleep(Duration::from_millis(75));
          let _ = window.show();
        });
      }

      Ok(())
    })
    .plugin(tauri_plugin_http::init())
    .plugin(
      tauri_plugin_window_state::Builder::default()
        .with_state_flags(tauri_plugin_window_state::StateFlags::all())
        .build(),
    )
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
