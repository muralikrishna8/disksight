use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::AppHandle;
use tauri::State;

use crate::scanner::{self, FileEntry, ScanResult, TopFileEntry};

pub struct ScanCancel(pub Arc<AtomicBool>);

impl ScanCancel {
    pub fn new() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }
}

#[tauri::command]
pub async fn scan_directory_cmd(
    app: AppHandle,
    cancel: State<'_, ScanCancel>,
    path: String,
    top_count: usize,
) -> Result<ScanResult, String> {
    cancel.0.store(false, Ordering::SeqCst);
    let flag = cancel.0.clone();
    let top = top_count.max(1).min(500);
    let app_c = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_directory(&path, &app_c, top, Some(flag.as_ref()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn cancel_scan_cmd(cancel: State<'_, ScanCancel>) {
    cancel.0.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn get_top_files_cmd(app: AppHandle, path: String, count: usize) -> Result<Vec<TopFileEntry>, String> {
    let path = scanner::expand_home(&path)?;
    let n = count.max(1).min(500);
    let (_, _, top) = scanner::scan_fs(&path, &app, n, None)?;
    Ok(top)
}

#[tauri::command]
pub fn expand_directory_cmd(app: AppHandle, cancel: State<'_, ScanCancel>, path: String) -> Result<FileEntry, String> {
    cancel.0.store(false, Ordering::SeqCst);
    scanner::expand_lazy_directory(&path, &app, Some(cancel.0.as_ref()))
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
