use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub files_count: u64,
    pub bytes_accumulated: u64,
    pub current_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
    pub item_count: u32,
    #[serde(default)]
    pub lazy_unloaded: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub root: FileEntry,
    pub top_files: Vec<TopFileEntry>,
}

pub(crate) fn expand_home(path: &str) -> Result<PathBuf, String> {
    if path == "~" {
        return home_dir_path();
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return Ok(home_dir_path()?.join(rest));
    }
    Ok(PathBuf::from(path))
}

fn home_dir_path() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Could not resolve home directory".to_string())
}

fn is_lazy_dir_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | ".git"
            | "dist"
            | "build"
            | ".next"
            | ".cache"
            | "__pycache__"
            | ".venv"
            | "vendor"
            | ".npm"
            | "Pods"
            | "DerivedData"
            | ".gradle"
    ) || name.ends_with(".xcworkspace")
        || name.ends_with(".xcodeproj")
}

fn should_skip_walk_entry(path: &Path) -> bool {
    let s = path.to_string_lossy();
    s.contains("/.Trashes")
        || s.contains("/Library/Application Support/com.apple.TCC")
}

pub(crate) fn scan_fs(
    root: &Path,
    app: &AppHandle,
    top_n: usize,
) -> Result<(HashMap<PathBuf, u64>, Vec<TopFileEntry>), String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let mut dir_bytes: HashMap<PathBuf, u64> = HashMap::new();
    let mut heap: BinaryHeap<Reverse<(u64, PathBuf)>> = BinaryHeap::new();
    let mut files_scanned: u64 = 0;
    let mut bytes_total: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    let walker = WalkDir::new(&root)
        .follow_links(false)
        .same_file_system(false)
        .into_iter()
        .filter_entry(|e| {
            let p = e.path();
            p.starts_with(&root) && !should_skip_walk_entry(p)
        });

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path().to_path_buf();
        if entry.file_type().is_file() {
            let size = match entry.metadata() {
                Ok(m) => m.len(),
                Err(_) => continue,
            };
            files_scanned += 1;
            bytes_total += size;

            if last_emit.elapsed().as_millis() > 120 {
                last_emit = std::time::Instant::now();
                let _ = app.emit(
                    "scan-progress",
                    ScanProgress {
                        files_count: files_scanned,
                        bytes_accumulated: bytes_total,
                        current_path: path.display().to_string(),
                    },
                );
            }

            let mut p = path.parent().map(Path::to_path_buf);
            while let Some(ref parent) = p {
                if !parent.starts_with(&root) {
                    break;
                }
                *dir_bytes.entry(parent.clone()).or_insert(0) += size;
                p = parent.parent().map(Path::to_path_buf);
            }

            if top_n > 0 {
                if heap.len() < top_n {
                    heap.push(Reverse((size, path.clone())));
                } else if let Some(&Reverse((min_size, _))) = heap.peek() {
                    if size > min_size {
                        heap.pop();
                        heap.push(Reverse((size, path.clone())));
                    }
                }
            }
        } else if entry.file_type().is_symlink() {
            continue;
        }
    }

    let mut top_files: Vec<TopFileEntry> = heap
        .into_sorted_vec()
        .into_iter()
        .map(|Reverse((size, p))| TopFileEntry {
            name: p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: p.display().to_string(),
            size,
        })
        .collect();
    top_files.sort_by(|a, b| b.size.cmp(&a.size));

    let _ = app.emit(
        "scan-progress",
        ScanProgress {
            files_count: files_scanned,
            bytes_accumulated: bytes_total,
            current_path: root.display().to_string(),
        },
    );

    Ok((dir_bytes, top_files))
}

fn count_direct_children(path: &Path) -> u32 {
    let Ok(rd) = fs::read_dir(path) else {
        return 0;
    };
    rd.filter_map(|e| e.ok()).count() as u32
}

pub(crate) fn build_tree(path: &Path, dir_bytes: &HashMap<PathBuf, u64>) -> Result<FileEntry, String> {
    let path = path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());

    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    let is_dir = meta.is_dir();

    if !is_dir {
        return Ok(FileEntry {
            name,
            path: path.display().to_string(),
            size: meta.len(),
            is_dir: false,
            children: None,
            item_count: 0,
            lazy_unloaded: false,
        });
    }

    let size = *dir_bytes.get(&path).unwrap_or(&0);
    let direct_count = count_direct_children(&path);

    let mut child_entries: Vec<FileEntry> = Vec::new();
    let mut read_dir: Vec<PathBuf> = fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    read_dir.sort_by(|a, b| {
        let an = a.file_name().unwrap_or_default();
        let bn = b.file_name().unwrap_or_default();
        an.cmp(bn)
    });

    for child_path in read_dir {
        let child_name = child_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();

        let cmeta = match fs::symlink_metadata(&child_path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        if cmeta.is_symlink() {
            continue;
        }

        if cmeta.is_dir() {
            if is_lazy_dir_name(&child_name) {
                let lazy_size = *dir_bytes.get(&child_path).unwrap_or(&0);
                let items = count_direct_children(&child_path);
                child_entries.push(FileEntry {
                    name: child_name,
                    path: child_path.display().to_string(),
                    size: lazy_size,
                    is_dir: true,
                    children: None,
                    item_count: items,
                    lazy_unloaded: true,
                });
            } else {
                child_entries.push(build_tree(&child_path, dir_bytes)?);
            }
        } else {
            let sz = cmeta.len();
            child_entries.push(FileEntry {
                name: child_name,
                path: child_path.display().to_string(),
                size: sz,
                is_dir: false,
                children: None,
                item_count: 0,
                lazy_unloaded: false,
            });
        }
    }

    Ok(FileEntry {
        name,
        path: path.display().to_string(),
        size,
        is_dir: true,
        children: Some(child_entries),
        item_count: direct_count,
        lazy_unloaded: false,
    })
}

pub fn scan_directory(path_str: &str, app: &AppHandle, top_n: usize) -> Result<ScanResult, String> {
    let path = expand_home(path_str)?;
    if !path.exists() {
        return Err("Path does not exist".into());
    }
    let (dir_bytes, top_files) = scan_fs(&path, app, top_n)?;
    let root = build_tree(&path, &dir_bytes)?;
    Ok(ScanResult { root, top_files })
}

pub fn expand_lazy_directory(path_str: &str, app: &AppHandle) -> Result<FileEntry, String> {
    let path = expand_home(path_str)?;
    let (dir_bytes, _) = scan_fs(&path, app, 0)?;
    let mut entry = build_tree(&path, &dir_bytes)?;
    entry.lazy_unloaded = false;
    Ok(entry)
}
