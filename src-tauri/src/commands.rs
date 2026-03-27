use tauri::AppHandle;

use crate::scanner::{self, FileEntry, ScanResult, TopFileEntry};

#[tauri::command]
pub fn scan_directory_cmd(app: AppHandle, path: String, top_count: usize) -> Result<ScanResult, String> {
    let top = top_count.max(1).min(500);
    scanner::scan_directory(&path, &app, top)
}

#[tauri::command]
pub fn get_top_files_cmd(app: AppHandle, path: String, count: usize) -> Result<Vec<TopFileEntry>, String> {
    let path = scanner::expand_home(&path)?;
    let n = count.max(1).min(500);
    let (_, top) = scanner::scan_fs(&path, &app, n)?;
    Ok(top)
}

#[tauri::command]
pub fn expand_directory_cmd(app: AppHandle, path: String) -> Result<FileEntry, String> {
    scanner::expand_lazy_directory(&path, &app)
}

#[tauri::command]
pub fn move_to_trash_cmd(path: String) -> Result<(), String> {
    let p = scanner::expand_home(&path)?;
    trash::delete(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_in_finder_cmd(path: String) -> Result<(), String> {
    let p = scanner::expand_home(&path)?;
    if !p.exists() {
        return Err("Path does not exist".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&p)
            .status()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Reveal in Finder is only available on macOS".into())
    }
}
