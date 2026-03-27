mod commands;
mod scanner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory_cmd,
            commands::get_top_files_cmd,
            commands::expand_directory_cmd,
            commands::move_to_trash_cmd,
            commands::open_in_finder_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
